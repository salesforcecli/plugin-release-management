/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as chalk from 'chalk';
import { verifyDependencies } from '../../../dependencies';
import { isMonoRepo, MultiPackageRepo } from '../../../repository';
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

    const monorepo = await MultiPackageRepo.create(this.ux);

    monorepo.printStage('Validate Next Version');
    const pkgValidations = monorepo.validate();

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
      monorepo.printStage('Install');
      monorepo.install();

      monorepo.printStage('Build');
      monorepo.build();
    }

    monorepo.printStage('Prepare Release');
    monorepo.prepare({ dryrun: this.flags.dryrun });

    let signatures: SigningResponse[] = [];
    if (this.flags.sign && !this.flags.dryrun) {
      monorepo.printStage('Sign');
      signatures = await monorepo.sign(this.flags.sign);
      monorepo.printStage('Upload Signatures');
      for (const signature of signatures) {
        this.ux.log(chalk.dim(signature.name));
        await monorepo.uploadSignature(signature);
      }
    }

    if (!this.flags.dryrun) {
      monorepo.printStage('Push Changes to Git');
      monorepo.pushChangesToGit();
    }

    monorepo.printStage('Publish');
    monorepo.publish({
      signatures,
      access: this.flags.npmaccess,
      tag: this.flags.npmtag,
      dryrun: this.flags.dryrun,
    });

    if (!this.flags.dryrun) {
      monorepo.printStage('Waiting For Availablity');
      const found = await monorepo.waitForAvailability();
      if (!found) {
        this.ux.warn('Exceeded timeout waiting for packages to become available');
      }
    }

    if (this.flags.sign && !this.flags.dryrun) {
      monorepo.printStage('Verify Signed Packaged');
      monorepo.verifySignature(this.flags.sign);
    }

    this.ux.log(monorepo.getSuccessMessage());

    return monorepo.packages.map((pkg) => {
      return { name: pkg.name, version: pkg.getNextVersion() };
    });
  }
}
