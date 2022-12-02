/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as chalk from 'chalk';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
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

export default class Release extends SfCommand<ReleaseResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly flags = {
    dryrun: Flags.boolean({
      char: 'd',
      default: false,
      summary: messages.getMessage('dryrun'),
    }),
    sign: Flags.boolean({
      char: 's',
      default: false,
      summary: messages.getMessage('sign'),
    }),
    npmtag: Flags.string({
      char: 't',
      default: 'latest',
      summary: messages.getMessage('npmTag'),
    }),
    npmaccess: Flags.string({
      char: 'a',
      default: 'public',
      summary: messages.getMessage('npmAccess'),
    }),
    install: Flags.boolean({
      default: true,
      summary: messages.getMessage('install'),
      allowNo: true,
    }),
    prerelease: Flags.string({
      summary: messages.getMessage('prerelease'),
    }),
    verify: Flags.boolean({
      summary: messages.getMessage('verify'),
      default: true,
      allowNo: true,
    }),
    githubtag: Flags.string({
      summary: messages.getMessage('githubtag'),
    }),
  };

  public async run(): Promise<ReleaseResult> {
    const { flags } = await this.parse(Release);
    const deps = verifyDependencies(flags);
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfError(messages.getMessage(errType), errType, missing);
    }

    const pkg = await PackageRepo.create({
      ux: new Ux({ jsonEnabled: this.jsonEnabled() }),
      useprerelease: flags.prerelease,
    });
    if (!pkg.shouldBePublished) {
      this.log('Found no commits that warrant a release. Exiting...');
      return;
    }

    await pkg.writeNpmToken();

    if (flags.githubtag) {
      this.log(`Using Version: ${pkg.nextVersion}`);
    } else {
      pkg.printStage('Validate Next Version');
      const pkgValidation = pkg.validate();
      if (!pkgValidation.valid) {
        const errType = 'InvalidNextVersion';
        throw new SfError(messages.getMessage(errType, [pkgValidation.nextVersion]), errType);
      }
      this.log(`Name: ${pkgValidation.name}`);
      this.log(`Current Version: ${pkgValidation.currentVersion}`);
      this.log(`Next Version: ${pkgValidation.nextVersion}`);
    }

    if (flags.install) {
      pkg.printStage('Install');
      pkg.install();

      pkg.printStage('Build');
      pkg.build();
    }

    if (!flags.githubtag) {
      pkg.printStage('Prepare Release');
      pkg.prepare({ dryrun: flags.dryrun });
    }
    let signature: SigningResponse;
    if (flags.sign && !flags.dryrun) {
      pkg.printStage('Sign and Upload Security Files');
      signature = await pkg.sign();
    }

    pkg.printStage('Publish');
    try {
      await pkg.publish({
        signatures: [signature],
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

    try {
      if (flags.sign && flags.verify && !flags.dryrun) {
        pkg.printStage('Verify Signed Packaged');
        this.verifySign(pkg.getPkgInfo());
      }
    } finally {
      if (!flags.dryrun && !flags.githubtag) {
        pkg.printStage('Push Changes to Git');
        pkg.pushChangesToGit();
      }
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
      const result = exec(`DEBUG=sfdx:* ${this.config.root}/bin/run ${cmd} ${argv}`);
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
