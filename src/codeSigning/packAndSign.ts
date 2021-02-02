#!/usr/bin/env node
/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-underscore-dangle */

import { exec } from 'child_process';
import { EOL } from 'os';
import { basename, join as pathJoin } from 'path';
import { sep as pathSep } from 'path';
import { Readable } from 'stream';
import { TLSSocket } from 'tls';
import { copyFile, createReadStream } from 'fs';
import * as https from 'https';
import { UX } from '@salesforce/command';
import { fs, Logger } from '@salesforce/core';
import { NamedError } from '@salesforce/kit';
import {
  CodeSignInfo,
  CodeVerifierInfo,
  default as sign,
  validateRequestCert,
  validSalesforceHostname,
  verify,
} from '../codeSigning/codeSignApi';
import { PackageJson } from '../package';
import { ExecProcessFailed, InvalidUrlError, SignSignedCertError } from './error';
import { NpmName } from './NpmName';

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
    } else if (target && target.includes(this._cwd)) {
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

let cliUx: UX;
let pathGetter: PathGetter;

export interface SigningResponse {
  tarPath: string;
  filename: string;
  verified: boolean;
  version?: string;
  name?: string;
}

export interface SigningOpts {
  publickeyurl: string;
  signatureurl: string;
  privatekeypath: string;
  target?: string;
  tarpath?: string;
}

export const api = {
  setUx(ux: UX): void {
    cliUx = ux;
  },

  /**
   * Validates that a url is a valid salesforce url.
   *
   * @param url - The url to validate.
   */
  validateUrl(url: string): void {
    try {
      // new URL throws if a host cannot be parsed out.
      if (!validSalesforceHostname(url)) {
        // noinspection ExceptionCaughtLocallyJS
        throw new NamedError(
          'NotASalesforceHost',
          'Signing urls must have the hostname developer.salesforce.com and use https.'
        );
      }
    } catch (e) {
      if (e instanceof NamedError) {
        throw e;
      } else {
        throw new InvalidUrlError(url, e);
      }
    }
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
        (error: Error, stdout: string, stderr: string) => {
          if (error && error['code']) {
            return reject(new ExecProcessFailed(command, error['code'], stderr));
          } else {
            const output = stdout.split(EOL);
            if (output.length > 1) {
              // note the output end with a newline;
              const path = output[output.length - 2];
              if (path && path.endsWith('tgz')) {
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
   * verify a signature against a public key and tgz content
   *
   * @param tarGzStream - Tar file to validate
   * @param sigFilenameStream - Computed signature
   * @param publicKeyUrl - url for the public key
   */
  verify(tarGzStream: Readable, sigFilenameStream: Readable, publicKeyUrl: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const verifyInfo = new CodeVerifierInfo();
      verifyInfo.dataToVerify = tarGzStream;
      verifyInfo.signatureStream = sigFilenameStream;

      const req = https.get(publicKeyUrl, { agent: false });
      validateRequestCert(req);

      req.on('response', (response) => {
        if (response && response.statusCode === 200) {
          verifyInfo.publicKeyStream = response;
          return resolve(verify(verifyInfo));
        } else {
          const statusCode: number = response.statusCode;
          return reject(
            new NamedError(
              'RetrievePublicKeyFailed',
              `Couldn't retrieve public key at url: ${publicKeyUrl} error code: ${statusCode}`
            )
          );
        }
      });

      req.on('error', (err: Error) => {
        if (err && err['code'] === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          reject(new SignSignedCertError());
        } else {
          reject(err);
        }
      });
    });
  },

  /**
   * sign a tgz file stream
   *
   * @param fileStream - the tgz file stream to sign
   * @param privateKeyStream - the certificate's private key
   */
  retrieveSignature(fileStream: Readable, privateKeyStream: Readable): Promise<string> {
    const info = new CodeSignInfo();
    info.dataToSignStream = fileStream;
    info.privateKeyStream = privateKeyStream;
    return sign(info);
  },

  /**
   * write the signature to a '.sig' file. this file is to be deployed to signatureurk
   *
   * @param filePath - the file path to the tgz file
   * @param signature - the computed signature
   */
  async writeSignatureFile(filePath: string, signature: string): Promise<string> {
    if (!filePath.endsWith('tgz')) {
      throw new NamedError('UnexpectedTgzName', `The file path ${filePath} is unexpected. It should be a tgz file.`);
    }
    if (!pathGetter) pathGetter = new PathGetter();
    cliUx.log(`Signing file at: ${filePath}`);
    const pathComponents: string[] = filePath.split(pathSep);
    const filenamePart: string = pathComponents[pathComponents.length - 1];
    const sigFilename = filenamePart.replace('.tgz', '.sig');
    await fs.writeFile(pathGetter.getFile(sigFilename), signature);
    return sigFilename;
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
  copyPackageDotJson(src: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      copyFile(src, dest, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  },

  /**
   * used to update the contents of package.json
   *
   * @param pJson - the updated json content to write to disk
   */
  writePackageJson(pJson: PackageJson): Promise<void> {
    return fs.writeFile(pathGetter.packageJson, JSON.stringify(pJson, null, 4));
  },

  async doSign(args: SigningOpts, packageJson?: { name: string; version: string }): Promise<SigningResponse> {
    const logger = await Logger.child('packAndSign');
    const filepath = args.tarpath;

    if (!filepath) {
      throw new NamedError('MissingTarFile', 'A tgz file to sign was not specified.');
    }

    // create the signature file
    const signature = await api.retrieveSignature(
      createReadStream(filepath, { encoding: 'binary' }),
      createReadStream(args.privatekeypath)
    );
    logger.debug('created the digital signature');
    if (signature && signature.length > 0) {
      // write the signature file to disk
      const sigFilename = await api.writeSignatureFile(filepath, signature);

      cliUx.log(`Artifact signed and saved in ${sigFilename}`);

      let verified: boolean;
      try {
        // verify the signature with the public key url
        verified = await api.verify(
          createReadStream(filepath, { encoding: 'binary' }),
          createReadStream(sigFilename),
          args.publickeyurl
        );
      } catch (e) {
        cliUx.error(e);
        throw new NamedError(
          'VerificationError',
          'An error occurred trying to validate the signature. Check the public key url and try again.',
          e
        );
      }
      if (verified) {
        cliUx.log(`Successfully verified signature with public key at: ${args.publickeyurl}`);
        return {
          tarPath: filepath,
          filename: sigFilename,
          verified,
          name: packageJson?.name,
          version: packageJson?.version,
        };
      } else {
        // noinspection ExceptionCaughtLocallyJS
        throw new NamedError('FailedToVerifySignature', 'Failed to verify signature with tar gz content');
      }
    } else {
      // noinspection ExceptionCaughtLocallyJS
      throw new NamedError('EmptySignature', 'The generated signature is empty. Verify the private key and try again');
    }
  },

  /**
   * main method to pack and sign an npm.
   *
   * @param args - reference to process.argv
   * @param ux - The cli ux interface usually provided by oclif.
   * @return {Promise<SigningResponse>} The SigningResponse
   */
  async doPackAndSign(args: SigningOpts): Promise<SigningResponse> {
    const logger = await Logger.child('packAndSign');
    let packageDotJsonBackedUp = false;
    pathGetter = new PathGetter(args.target);

    try {
      logger.debug(`validating args.signatureurl: ${args.signatureurl}`);
      logger.debug(`validating args.publickeyurl: ${args.publickeyurl}`);
      api.validateUrl(args.signatureurl);
      api.validateUrl(args.publickeyurl);

      // read package.json info
      const packageJsonContent: string = await api.retrievePackageJson();
      let packageJson = JSON.parse(packageJsonContent) as PackageJson;
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

      // compute the name of the signature file
      const npmName: NpmName = NpmName.parse(packageJson.name);
      logger.debug(`parsed the following npmName components: ${JSON.stringify(npmName, null, 4)}`);
      npmName.tag = packageJson.version;
      const sigFilename = pathGetter.getFile(npmName.toFilename('.sig'));
      logger.debug(`using sigFilename: ${sigFilename}`);

      // make a backup of the signature file
      await api.copyPackageDotJson(pathGetter.packageJson, pathGetter.packageJsonBak);
      logger.debug('made a backup of the package.json file.');

      packageDotJsonBackedUp = true;
      cliUx.log(`Backed up ${pathGetter.packageJson} to ${pathGetter.packageJsonBak}`);

      // update the package.json object with the signature urls and write it to disk.
      const sigUrl = `${args.signatureurl}${args.signatureurl.endsWith('/') ? '' : '/'}${basename(sigFilename)}`;
      logger.debug(`sigUrl: ${sigUrl}`);
      packageJson = Object.assign(packageJson, {
        sfdx: {
          publicKeyUrl: args.publickeyurl,
          signatureUrl: `${sigUrl}`,
        },
      }) as PackageJson;
      await api.writePackageJson(packageJson);

      cliUx.log('Successfully updated package.json with public key and signature file locations.');

      const filepath = await api.pack();
      args.tarpath = filepath;
      return api.doSign(args);
    } finally {
      // Restore the package.json file so it doesn't show a git diff.
      if (packageDotJsonBackedUp) {
        cliUx.log('Restoring package.json');
        await api.copyPackageDotJson(pathGetter.packageJsonBak, pathGetter.packageJson);
        await fs.unlink(pathGetter.packageJsonBak);
      }
    }
  },

  /**
   * Retrieve the fingerprint from a url where a cert is hosted
   *
   * @param publicKeyUrl
   */
  async retrieveFingerprint(publicKeyUrl: string): Promise<string> {
    return new Promise((resolve) => {
      let fingerprint: string;
      const req = https.request(publicKeyUrl, { agent: false });
      req.on('socket', (socket: TLSSocket) => {
        socket.on('secureConnect', () => {
          fingerprint = socket.getPeerCertificate(true).fingerprint;
          resolve(fingerprint);
        });
      });
      req.end();
    });
  },
};
