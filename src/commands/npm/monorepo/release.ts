/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as chalk from 'chalk';
import * as util from '../../../package';
import { verifyDependencies } from '../../../dependencies';
import { isMonoRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.package.release');

interface PrepareResult {
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
  };

  public async run(): Promise<PrepareResult> {
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

    const pkg = await util.Package.create(this.ux);
    this.ux.log(util.getStepMsg('Validate Next Version'));
    const pkgValidation = pkg.validateNextVersion();
    if (!pkgValidation.valid) {
      const errType = 'InvalidNextVersion';
      throw new SfdxError(messages.getMessage(errType, [pkgValidation.nextVersion]), errType);
    }
    this.ux.log(`Current Version: ${pkgValidation.currentVersion}`);
    this.ux.log(`Next Version: ${pkgValidation.nextVersion}`);

    if (this.flags.install) {
      this.ux.log(util.getStepMsg('Install'));
      pkg.install();

      this.ux.log(util.getStepMsg('Build'));
      pkg.build();
    }

    this.ux.log(util.getStepMsg('Prepare Release'));
    pkg.prepare({ dryrun: this.flags.dryrun });

    let tarfile: string;
    if (this.flags.sign && !this.flags.dryrun) {
      this.ux.log(util.getStepMsg('Sign'));
      const signature = await pkg.sign();
      tarfile = signature.tarPath;
      this.ux.log(util.getStepMsg('Upload Signature'));
      pkg.uploadSignature(signature);
    }

    this.ux.log(util.getStepMsg('Publish'));
    pkg.publish({
      tarfile,
      access: this.flags.npmaccess,
      tag: this.flags.npmtag,
      dryrun: this.flags.dryrun,
    });

    if (!this.flags.dryrun) {
      this.ux.log(util.getStepMsg('Waiting For Availablity'));
      const found = await pkg.waitForVersionToExistOnNpm();
      if (!found) {
        this.ux.warn(`Exceeded timeout waiting for ${pkg.name}@${pkg.nextVersion} to become available`);
      }
    }

    if (this.flags.sign && !this.flags.dryrun) {
      this.ux.log(util.getStepMsg('Verify Signed Packaged'));
      pkg.verifySignature();
    }

    this.ux.log(chalk.green.bold(`Successfully released ${pkg.name}@${pkg.nextVersion}`));

    return {
      version: pkg.nextVersion,
      name: pkg.name,
    };
  }
}
