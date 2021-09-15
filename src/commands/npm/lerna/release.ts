/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as chalk from 'chalk';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { PackageInfo } from '../../../repository';
import { verifyDependencies } from '../../../dependencies';
import { Access, isMonoRepo, LernaRepo } from '../../../repository';
import { SigningResponse } from '../../../codeSigning/SimplifiedSigning';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.lerna.release');

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
    sign: flags.array({
      char: 's',
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
    githubrelease: flags.boolean({
      default: false,
      description: messages.getMessage('githubRelease'),
    }),
    verify: flags.boolean({
      description: messages.getMessage('verify'),
      default: true,
      allowNo: true,
    }),
  };

  public async run(): Promise<ReleaseResult[]> {
    if (!(await isMonoRepo())) {
      const errType = 'InvalidRepoType';
      throw new SfdxError(messages.getMessage(errType), errType);
    }

    const deps = verifyDependencies(this.flags);
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfdxError(messages.getMessage(errType), errType, missing);
    }

    const lernaRepo = await LernaRepo.create({ ux: this.ux });
    if (!lernaRepo.packages.length) {
      this.ux.log(messages.getMessage('NoChangesToPublish'));
      return;
    }

    await lernaRepo.writeNpmToken();

    lernaRepo.printStage('Validate Next Version');
    const pkgValidations = lernaRepo.validate();

    pkgValidations.forEach((pkgValidation) => {
      if (!pkgValidation.valid) {
        const errType = 'InvalidNextVersion';
        throw new SfdxError(messages.getMessage(errType, [pkgValidation.nextVersion]), errType);
      }
      this.ux.log(`Package: ${pkgValidation.name}`);
      this.ux.log(`Current Version: ${pkgValidation.currentVersion}`);
      this.ux.log(`Next Version: ${pkgValidation.nextVersion}${os.EOL}`);
    });

    if (this.flags.install) {
      lernaRepo.printStage('Install');
      lernaRepo.install();

      lernaRepo.printStage('Build');
      lernaRepo.build();
    }

    lernaRepo.printStage('Prepare Release');
    lernaRepo.prepare({
      dryrun: this.flags.dryrun as boolean,
      githubRelease: this.flags.githubrelease as boolean,
    });

    let signatures: SigningResponse[] = [];
    if (this.flags.sign && !this.flags.dryrun) {
      lernaRepo.printStage('Sign and Upload Signatures');
      signatures = await lernaRepo.sign(this.flags.sign);
    }

    lernaRepo.printStage('Publish');
    await lernaRepo.publish({
      signatures,
      access: this.flags.npmaccess as Access,
      tag: this.flags.npmtag as string,
      dryrun: this.flags.dryrun as boolean,
    });

    if (!this.flags.dryrun) {
      lernaRepo.printStage('Push Changes to Git');
      lernaRepo.pushChangesToGit();
    }

    if (!this.flags.dryrun) {
      lernaRepo.printStage('Waiting For Availability');
      const found = await lernaRepo.waitForAvailability();
      if (!found) {
        this.ux.warn('Exceeded timeout waiting for packages to become available');
      }
    }

    if (this.flags.sign && this.flags.verify && !this.flags.dryrun) {
      lernaRepo.printStage('Verify Signed Packaged');
      const pkgs = lernaRepo.getPkgInfo(this.flags.sign);

      for (const pkg of pkgs) {
        await this.verifySign(pkg);
      }
    }

    this.ux.log(lernaRepo.getSuccessMessage());

    return lernaRepo.packages.map((pkg) => {
      return { name: pkg.name, version: pkg.getNextVersion() };
    });
  }

  protected async verifySign(pkgInfo: PackageInfo): Promise<void> {
    const cmd = 'plugins:trust:verify';
    const argv = `--npm ${pkgInfo.name}@${pkgInfo.nextVersion} ${pkgInfo.registryParam}`;

    this.ux.log(chalk.dim(`sf-release ${cmd} ${argv}`) + os.EOL);
    try {
      await this.config.runCommand(cmd, argv.split(' '));
    } catch (err) {
      throw new SfdxError(err, 'FailedCommandExecution');
    }
  }
}
