/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as chalk from 'chalk';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfError } from '@salesforce/core';
import { exec } from 'shelljs';
import { PackageInfo } from '../../../repository';
import { verifyDependencies } from '../../../dependencies';
import { Access, PackageRepo } from '../../../repository';
import { SigningResponse } from '../../../codeSigning/SimplifiedSigning';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.package.release');

interface ReleaseResult {
  version: string;
  name: string;
}

export default class Release extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    dryrun: flags.boolean({
      char: 'd',
      default: false,
      description: messages.getMessage('dryrun'),
    }),
    sign: flags.boolean({
      char: 's',
      default: false,
      description: messages.getMessage('sign'),
    }),
    npmtag: flags.string({
      char: 't',
      default: 'latest',
      description: messages.getMessage('npmTag'),
    }),
    npmaccess: flags.string({
      char: 'a',
      default: 'public',
      description: messages.getMessage('npmAccess'),
    }),
    install: flags.boolean({
      default: true,
      description: messages.getMessage('install'),
      allowNo: true,
    }),
    prerelease: flags.string({
      description: messages.getMessage('prerelease'),
    }),
    verify: flags.boolean({
      description: messages.getMessage('verify'),
      default: true,
      allowNo: true,
    }),
    githubtag: flags.string({
      description: messages.getMessage('githubtag'),
    }),
  };

  public async run(): Promise<ReleaseResult> {
    const deps = verifyDependencies(this.flags);
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfError(messages.getMessage(errType), errType, missing);
    }

    const pkg = await PackageRepo.create({ ux: this.ux, useprerelease: this.flags.prerelease as string });
    if (!pkg.shouldBePublished) {
      this.ux.log('Found no commits that warrant a release. Exiting...');
      return;
    }

    await pkg.writeNpmToken();

    if (this.flags.githubtag) {
      this.ux.log(`Using Version: ${pkg.nextVersion}`);
    } else {
      pkg.printStage('Validate Next Version');
      const pkgValidation = pkg.validate();
      if (!pkgValidation.valid) {
        const errType = 'InvalidNextVersion';
        throw new SfError(messages.getMessage(errType, [pkgValidation.nextVersion]), errType);
      }
      this.ux.log(`Name: ${pkgValidation.name}`);
      this.ux.log(`Current Version: ${pkgValidation.currentVersion}`);
      this.ux.log(`Next Version: ${pkgValidation.nextVersion}`);
    }

    if (this.flags.install) {
      pkg.printStage('Install');
      pkg.install();

      pkg.printStage('Build');
      pkg.build();
    }

    if (!this.flags.githubtag) {
      pkg.printStage('Prepare Release');
      pkg.prepare({ dryrun: this.flags.dryrun as boolean });
    }
    let signature: SigningResponse;
    if (this.flags.sign && !this.flags.dryrun) {
      pkg.printStage('Sign and Upload Security Files');
      signature = await pkg.sign();
    }

    pkg.printStage('Publish');
    try {
      await pkg.publish({
        signatures: [signature],
        access: this.flags.npmaccess as Access,
        tag: this.flags.npmtag as string,
        dryrun: this.flags.dryrun as boolean,
      });
    } catch (err) {
      if (!(err instanceof Error) || typeof err !== 'string') {
        throw err;
      }
      this.error(err, { code: 'NPM_PUBLISH_FAILED', exit: 1 });
    }

    if (!this.flags.dryrun && this.flags.verify) {
      pkg.printStage('Waiting For Availability');
      const found = await pkg.waitForAvailability();
      if (!found) {
        this.ux.warn(`Exceeded timeout waiting for ${pkg.name}@${pkg.nextVersion} to become available`);
      }
    }

    try {
      if (this.flags.sign && this.flags.verify && !this.flags.dryrun) {
        pkg.printStage('Verify Signed Packaged');
        this.verifySign(pkg.getPkgInfo());
      }
    } finally {
      if (!this.flags.dryrun && !this.flags.githubtag) {
        pkg.printStage('Push Changes to Git');
        pkg.pushChangesToGit();
      }
    }

    this.ux.log(pkg.getSuccessMessage());

    return {
      version: pkg.nextVersion,
      name: pkg.name,
    };
  }

  protected verifySign(pkgInfo: PackageInfo): void {
    const cmd = 'plugins:trust:verify';
    const argv = `--npm ${pkgInfo.name}@${pkgInfo.nextVersion} ${pkgInfo.registryParam}`;

    this.ux.log(chalk.dim(`sf-release ${cmd} ${argv}`) + os.EOL);
    try {
      const result = exec(`DEBUG=sfdx:* ${this.config.root}/bin/run ${cmd} ${argv}`);
      if (result.code !== 0) {
        const sfdxVerifyCmd = `sfdx plugins:trust:verify ${argv}`;
        this.ux.warn(
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
