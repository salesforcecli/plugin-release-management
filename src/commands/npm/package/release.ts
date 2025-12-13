/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import os from 'node:os';
import chalk from 'chalk';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import shelljs from 'shelljs';
import { isString } from '@salesforce/ts-types';
import { PackageInfo } from '../../../repository.js';
import { verifyDependencies } from '../../../dependencies.js';
import { Access, PackageRepo } from '../../../repository.js';
import { SigningResponse } from '../../../codeSigning/SimplifiedSigning.js';

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
    oidc: Flags.boolean({
      default: false,
      summary: messages.getMessage('flags.oidc.summary'),
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
      useoidc: flags.oidc,
    });

    await pkg.writeNpmToken();

    if (flags.githubtag) {
      this.log(`Using Version: ${pkg.nextVersion}`);
    }

    if (flags.install) {
      pkg.printStage('Install');
      pkg.install();

      pkg.printStage('Build');
      pkg.build();
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
      });
    } catch (err) {
      if (!(err instanceof Error) || typeof err !== 'string') {
        throw err;
      }
      this.error(err, { code: 'NPM_PUBLISH_FAILED', exit: 1 });
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
