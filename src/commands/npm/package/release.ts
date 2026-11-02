/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import shelljs from 'shelljs';
import { isString } from '@salesforce/ts-types';
import { PackageInfo } from '../../../repository.js';
import { verifyDependencies } from '../../../dependencies.js';
import { Access, PackageRepo } from '../../../repository.js';

import { SigningResponse } from '../../../codeSigning/SimplifiedSigning.js';
import { pinInstalledDependencies, pinSkipReason } from '../../../pinDependencies.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.package.release');

export type ReleaseResult = {
  version: string;
  name: string;
};

export default class Release extends SfCommand<ReleaseResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    dryrun: Flags.boolean({
      char: 'd',
      default: false,
      summary: messages.getMessage('flags.dryrun.summary'),
    }),
    sign: Flags.boolean({
      char: 's',
      default: false,
      summary: messages.getMessage('flags.sign.summary'),
    }),
    npmtag: Flags.string({
      char: 't',
      default: 'latest',
      summary: messages.getMessage('flags.npmtag.summary'),
    }),
    npmaccess: Flags.string({
      char: 'a',
      default: 'public',
      summary: messages.getMessage('flags.npmaccess.summary'),
    }),
    install: Flags.boolean({
      default: true,
      summary: messages.getMessage('flags.install.summary'),
      allowNo: true,
    }),
    prerelease: Flags.string({
      summary: messages.getMessage('flags.prerelease.summary'),
    }),
    verify: Flags.boolean({
      summary: messages.getMessage('flags.verify.summary'),
      default: true,
      allowNo: true,
    }),
    githubtag: Flags.string({
      summary: messages.getMessage('flags.githubtag.summary'),
    }),
    'trusted-publishing': Flags.boolean({
      default: false,
      summary: messages.getMessage('flags.trusted-publishing.summary'),
    }),
    'pin-dependencies': Flags.boolean({
      default: true,
      allowNo: true,
      summary: messages.getMessage('flags.pin-dependencies.summary'),
      description: messages.getMessage('flags.pin-dependencies.description'),
    }),
  };

  public async run(): Promise<ReleaseResult> {
    const { flags } = await this.parse(Release);
    const deps = verifyDependencies(flags);
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results
        .filter((d) => d.passed === false)
        .map((d) => d.message)
        .filter(isString);
      throw new SfError(messages.getMessage(errType), errType, missing);
    }

    const pkg = await PackageRepo.create({
      ux: new Ux({ jsonEnabled: this.jsonEnabled() }),
      useprerelease: flags.prerelease,
    });

    // With Trusted Publishing (OIDC) npm authenticates via the CI identity, so no token is written.
    if (!flags['trusted-publishing']) {
      await pkg.writeNpmToken();
    }

    if (flags.githubtag) {
      this.log(`Using Version: ${pkg.nextVersion}`);
    }

    if (flags.install) {
      pkg.printStage('Install');
      pkg.install();

      pkg.printStage('Build');
      pkg.build();
    }

    const pkgJsonPath = path.join(pkg.package.location, 'package.json');
    let unpinnedPackageJson: string | undefined;
    try {
      // signing packs the package, so pinning has to happen first
      const pins = flags['pin-dependencies'] ? this.pinDependencies(pkg) : undefined;
      if (pins) {
        unpinnedPackageJson = pins.original;
        fs.writeFileSync(pkgJsonPath, pins.pinned);
      }

      let signature: SigningResponse | undefined;
      if (flags.sign && !flags.dryrun) {
        pkg.printStage('Sign and Upload Security Files');
        signature = await pkg.sign();
      }

      pkg.printStage('Publish');
      try {
        await pkg.publish({
          ...(signature ? { signatures: [signature] } : {}),
          access: flags.npmaccess as Access,
          tag: flags.npmtag,
          dryrun: flags.dryrun,
          trustedPublishing: flags['trusted-publishing'],
        });
      } catch (err) {
        if (!(err instanceof Error) || typeof err !== 'string') {
          throw err;
        }
        this.error(err, { code: 'NPM_PUBLISH_FAILED', exit: 1 });
      }
    } finally {
      // the pins are only for the published package, keep the repo's ranges
      if (unpinnedPackageJson !== undefined) {
        fs.writeFileSync(pkgJsonPath, unpinnedPackageJson);
      }
    }

    if (!flags.dryrun && flags.verify) {
      pkg.printStage('Waiting For Availability');
      const found = await pkg.waitForAvailability();
      if (!found) {
        this.warn(`Exceeded timeout waiting for ${pkg.name}@${pkg.nextVersion} to become available`);
      }
    }

    if (flags.sign && flags.verify && !flags.dryrun) {
      pkg.printStage('Verify Signed Packaged');
      this.verifySign(pkg.getPkgInfo());
    }

    this.log(pkg.getSuccessMessage());

    return {
      version: pkg.nextVersion,
      name: pkg.name,
    };
  }

  /** Pin every production dependency to the version yarn.lock installed. Returns the original and pinned package.json. */
  protected pinDependencies(pkg: PackageRepo): { original: string; pinned: string } | undefined {
    pkg.printStage('Pin Dependencies');
    const { packageJson, location } = pkg.package;
    const skipReason = pinSkipReason(packageJson);
    if (skipReason) {
      this.log(messages.getMessage('pinSkipped', [packageJson.name, skipReason]));
      return;
    }
    const original = fs.readFileSync(path.join(location, 'package.json'), 'utf8');
    const { dependencies, nested } = pinInstalledDependencies(location, packageJson);
    this.log(messages.getMessage('pinned', [Object.keys(dependencies).length, packageJson.name, nested.length]));
    // only swap dependencies in the file on disk, so nothing else held in memory gets published
    const pinned =
      JSON.stringify({ ...(JSON.parse(original) as Record<string, unknown>), dependencies }, null, 2) + os.EOL;
    return { original, pinned };
  }

  protected verifySign(pkgInfo: PackageInfo): void {
    const cmd = 'plugins:trust:verify';
    const argv = `--npm ${pkgInfo.name}@${pkgInfo.nextVersion} ${pkgInfo.registryParam}`;

    this.log(chalk.dim(`sf-release ${cmd} ${argv}`) + os.EOL);
    try {
      const result = shelljs.exec(`DEBUG=sfdx:* ${this.config.root}/bin/run ${cmd} ${argv}`);
      if (result.code !== 0) {
        const sfdxVerifyCmd = `sfdx plugins:trust:verify ${argv}`;
        this.warn(
          'Unable to verify the package signature due to:\n\nFailed to find @salesforce/sfdx-scanner@3.1.0 in the registry\n' +
            `\nYou can manually validate the package signature by running:\n\n${sfdxVerifyCmd}\n`
        );
      }
    } catch (err) {
      if (!(err instanceof Error) || typeof err !== 'string') {
        throw err;
      }
      throw new SfError(err, 'FailedCommandExecution');
    }
  }
}
