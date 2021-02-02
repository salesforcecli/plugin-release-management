/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { verifyDependencies } from '../../../dependencies';
import { Access, isMonoRepo, SinglePackageRepo } from '../../../repository';
import { SigningResponse } from '../../../codeSigning/packAndSign';

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
  };

  public async run(): Promise<ReleaseResult> {
    if (await isMonoRepo()) {
      const errType = 'InvalidRepoType';
      throw new SfdxError(messages.getMessage(errType), errType);
    }

    const deps = verifyDependencies(this.flags);
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfdxError(messages.getMessage(errType), errType, missing);
    }

    const pkg = await SinglePackageRepo.create(this.ux);
    if (!pkg.shouldBePublished) {
      this.ux.log('Found no commits that warrant a release. Exiting...');
      return;
    }

    pkg.printStage('Validate Next Version');
    const pkgValidation = pkg.validate();
    if (!pkgValidation.valid) {
      const errType = 'InvalidNextVersion';
      throw new SfdxError(messages.getMessage(errType, [pkgValidation.nextVersion]), errType);
    }
    this.ux.log(`Name: ${pkgValidation.name}`);
    this.ux.log(`Current Version: ${pkgValidation.currentVersion}`);
    this.ux.log(`Next Version: ${pkgValidation.nextVersion}`);

    if (this.flags.install) {
      pkg.printStage('Install');
      await pkg.install();

      pkg.printStage('Build');
      pkg.build();
    }

    pkg.printStage('Prepare Release');
    pkg.prepare({ dryrun: this.flags.dryrun as boolean });

    let signature: SigningResponse;
    if (this.flags.sign && !this.flags.dryrun) {
      pkg.printStage('Sign');
      signature = await pkg.sign();
      pkg.printStage('Upload Signature');
      await pkg.uploadSignature(signature);
    }

    if (!this.flags.dryrun) {
      pkg.printStage('Push Changes to Git');
      pkg.pushChangesToGit();
    }

    pkg.printStage('Publish');
    await pkg.publish({
      signatures: [signature],
      access: this.flags.npmaccess as Access,
      tag: this.flags.npmtag as string,
      dryrun: this.flags.dryrun as boolean,
    });

    if (!this.flags.dryrun) {
      pkg.printStage('Waiting For Availablity');
      const found = await pkg.waitForAvailability();
      if (!found) {
        this.ux.warn(`Exceeded timeout waiting for ${pkg.name}@${pkg.nextVersion} to become available`);
      }
    }

    if (this.flags.sign && !this.flags.dryrun) {
      pkg.printStage('Verify Signed Packaged');
      pkg.verifySignature();
    }

    this.ux.log(pkg.getSuccessMessage());

    return {
      version: pkg.nextVersion,
      name: pkg.name,
    };
  }
}
