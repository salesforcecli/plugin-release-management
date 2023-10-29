#!/usr/bin/env node
/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-underscore-dangle */

import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { EOL } from 'node:os';
import { join as pathJoin } from 'node:path';
import { Agents } from 'got';
import { Ux } from '@salesforce/sf-plugins-core';
import { Logger } from '@salesforce/core';
import { NamedError } from '@salesforce/kit';
import { ProxyAgent } from 'proxy-agent';
import { PackageJson } from '../package';
import { signVerifyUpload as sign2, SigningResponse, getSfdxProperty } from './SimplifiedSigning';
import { ExecProcessFailed } from './error';
import { parseNpmName } from './NpmName';

class PathGetter {
  private static packageJson = 'package.json';

  private _packageJson: string;
  private _packageJsonBak: string;
  private _target: string;
  private _cwd: string;

  public constructor(target?: string) {
    this._cwd = process.cwd();
    if (!target) {
      this._target = this._cwd;
    } else if (target?.includes(this._cwd)) {
      this._target = target;
    } else {
      this._target = pathJoin(this._cwd, target);
    }
    this._packageJson = pathJoin(this._target, PathGetter.packageJson);
    this._packageJsonBak = pathJoin(this._target, `${PathGetter.packageJson}.bak`);
  }

  public get packageJson(): string {
    return this._packageJson;
  }

  public get packageJsonBak(): string {
    return this._packageJsonBak;
  }

  public get target(): string {
    return this._target;
  }

  public getFile(filename: string): string {
    return pathJoin(this._target, filename);
  }

  public getIgnoreFile(filename: string): string {
    return pathJoin(this._cwd, filename);
  }
}

let cliUx: Ux;
let pathGetter: PathGetter;

export const api = {
  setUx(ux: Ux): void {
    cliUx = ux;
  },

  /**
   * call out to npm pack;
   */
  pack(): Promise<string> {
    if (!pathGetter) pathGetter = new PathGetter();
    return new Promise<string>((resolve, reject) => {
      const command = 'npm pack -p';
      exec(
        command,
        { cwd: pathGetter.target, maxBuffer: 1024 * 4096 },
        // we expect an error code from this command, so we're adding it to the normal Error type
        (error: null | (Error & { code?: number | string }), stdout: string, stderr: string) => {
          if (error?.code) {
            return reject(new ExecProcessFailed(command, error['code'], stderr));
          } else {
            const output = stdout.split(EOL);
            if (output.length > 1) {
              // note the output end with a newline;
              const path = output[output.length - 2];
              if (path?.endsWith('tgz')) {
                return resolve(pathGetter.getFile(path));
              } else {
                return reject(
                  new NamedError(
                    'UnexpectedNpmFormat',
                    `Npm pack did not return an expected tgz filename result: [${path}]`
                  )
                );
              }
            } else {
              return reject(
                new NamedError('UnexpectedNpmFormat', `The output from the npm utility is unexpected [${stdout}]`)
              );
            }
          }
        }
      );
    });
  },

  /**
   * read the package.json file for the target npm to be signed.
   */
  retrievePackageJson(): Promise<string> {
    return fs.readFile(pathGetter.packageJson, { encoding: 'utf8' });
  },

  /**
   * read the npm ignore file for the target npm
   *
   * @param filename - local path to the npmignore file
   */
  retrieveIgnoreFile(filename: string): Promise<string> {
    return fs.readFile(pathGetter.getIgnoreFile(filename), { encoding: 'utf8' });
  },

  /**
   * checks the ignore content for the code signing patterns. *.tgz, *.sig package.json.bak
   *
   * @param content
   */
  validateNpmIgnorePatterns(content: string): void {
    const validate = (pattern: string): void => {
      if (!content) {
        throw new NamedError(
          'MissingNpmIgnoreFile',
          'Missing .npmignore file. The following patterns are required in for code signing: *.tgz, *.sig, package.json.bak.'
        );
      }

      if (!content.includes(pattern)) {
        throw new NamedError(
          'MissingNpmIgnorePattern',
          `.npmignore is missing ${pattern}. The following patterns are required for code signing: *.tgz, *.sig, package.json.bak`
        );
      }
    };
    validate('*.tgz');
    validate('*.sig');
    validate('package.json.bak');
  },

  /**
   * checks the ignore content for the code signing patterns. *.tgz, *.sig package.json.bak
   *
   * @param content
   */
  validateNpmFilePatterns(patterns: string[]): void {
    const validate = (pattern: string): void => {
      if (patterns.includes(pattern)) {
        throw new NamedError(
          'ForbiddenFilePattern',
          'the files property in package.json should not include the following: *.tgz, *.sig, package.json.bak'
        );
      }
    };
    validate('*.tgz');
    validate('*.sig');
    validate('package.json.bak');
  },

  /**
   * makes a backup copy pf package.json
   *
   * @param src - the package.json to backup
   * @param dest - package.json.bak
   */
  async copyPackageDotJson(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  },

  /**
   * used to update the contents of package.json
   *
   * @param pJson - the updated json content to write to disk
   */
  writePackageJson(pJson: PackageJson): Promise<void> {
    return fs.writeFile(pathGetter.packageJson, JSON.stringify(pJson, null, 4));
  },

  async revertPackageJsonIfExists(): Promise<void> {
    // Restore the package.json file so it doesn't show a git diff.
    await fs.access(pathGetter.packageJsonBak);
    cliUx.log(`Restoring package.json from ${pathGetter.packageJsonBak}`);
    await api.copyPackageDotJson(pathGetter.packageJsonBak, pathGetter.packageJson);
    await fs.unlink(pathGetter.packageJsonBak);
  },
  /**
   * main method to pack and sign an npm.
   *
   * @param args - reference to process.argv
   * @param ux - The cli ux interface usually provided by oclif.
   * @return {Promise<SigningResponse>} The SigningResponse
   */
  async packSignVerifyModifyPackageJSON(targetPackagePath: string): Promise<SigningResponse> {
    const logger = await Logger.child('packAndSign');
    pathGetter = new PathGetter(targetPackagePath);

    try {
      // read package.json info
      const packageJsonContent: string = await api.retrievePackageJson();
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;
      logger.debug('parsed the package.json content');

      if (packageJson.files) {
        // validate that files property does not include forbidden patterns
        api.validateNpmFilePatterns(packageJson.files);
      } else {
        // validate npm ignore has what we name.
        const npmIgnoreContent = await api.retrieveIgnoreFile('.npmignore');
        api.validateNpmIgnorePatterns(npmIgnoreContent);
        logger.debug('validated the expected npm ignore patterns');
      }

      // Recommend updating git ignore to match npmignore.
      const filename = '.gitignore';
      const gitIgnoreContent = await api.retrieveIgnoreFile(filename);
      try {
        api.validateNpmIgnorePatterns(gitIgnoreContent);
        logger.debug('validated the expected git ignore patterns');
      } catch (e) {
        cliUx.warn(
          `WARNING:  The following patterns are recommended in ${filename} for code signing: *.tgz, *.sig, package.json.bak.`
        );
      }

      // get the packageJson name/version
      const npmName = parseNpmName(packageJson.name);
      logger.debug(`parsed the following npmName components: ${JSON.stringify(npmName, null, 4)}`);
      npmName.tag = packageJson.version;

      // make a backup of the packageJson
      await api.copyPackageDotJson(pathGetter.packageJson, pathGetter.packageJsonBak);
      logger.debug('made a backup of the package.json file.');
      cliUx.log(`Backed up ${pathGetter.packageJson} to ${pathGetter.packageJsonBak}`);

      const packageNameWithOrWithoutScope = npmName.scope ? `@${npmName.scope}/${npmName.name}` : npmName.name;
      // we have to modify package.json with security URLs BEFORE packing
      // update the package.json object with the signature urls and write it to disk.
      packageJson.sfdx = getSfdxProperty(packageNameWithOrWithoutScope, npmName.tag);
      await api.writePackageJson(packageJson);
      cliUx.log('Successfully updated package.json with public key and signature file locations.');
      cliUx.styledJSON(packageJson.sfdx);

      const filepath = await api.pack();
      cliUx.log(`Packed tgz to ${filepath}`);

      const signResponse = await sign2({
        upload: true,
        targetFileToSign: filepath,
        packageName: packageNameWithOrWithoutScope,
        packageVersion: npmName.tag,
      });

      return signResponse;
    } finally {
      // prevent any publish-time changes from persisting to git
      await api.revertPackageJsonIfExists();
    }
  },

  getAgentForUri(url: string): false | Agents {
    const agent = new ProxyAgent();
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    return { https: agent, http: agent };
  },
};
