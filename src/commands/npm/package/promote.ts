/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { exec } from 'shelljs';
import { bold } from 'chalk';
import { SinglePackageRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.package.promote');

interface Token {
  token: string;
  key: string;
  readonly: boolean;
  automation: boolean;
}

export default class Promote extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    dryrun: flags.boolean({
      char: 'd',
      default: false,
      description: messages.getMessage('dryrun'),
    }),
    target: flags.string({
      char: 't',
      default: 'latest',
      description: messages.getMessage('target'),
    }),
    candidate: flags.string({
      char: 'c',
      description: messages.getMessage('candidate'),
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const pkg = await SinglePackageRepo.create({ ux: this.ux });
    await pkg.writeNpmToken();

    const token = ensureString(new Env().getString('NPM_TOKEN'), 'NPM_TOKEN must be set in the environment');
    const tokens = JSON.parse(exec('npm token list --json', { silent: true }).stdout) as Token[];
    const publishTokens = tokens.filter((t) => t.readonly === false && t.automation === false);
    const match = publishTokens.find((t) => token.substring(0, 6) === t.token);

    if (!match) {
      const errType = 'InvalidToken';
      throw new SfdxError(messages.getMessage(errType), errType);
    }

    const tags = pkg.package.npmPackage['dist-tags'];
    const candidate = ensureString(this.flags.candidate);
    const target = ensureString(this.flags.target);

    if (!tags[candidate]) {
      const errType = 'InvalidTag';
      throw new SfdxError(messages.getMessage(errType, [candidate]), errType);
    }

    this.log(`Promoting ${pkg.name}@${tags[candidate]} from ${bold(candidate)} to ${bold(target)}`);
    if (target) {
      this.warn(`This will overwrite the existing ${target} version: ${tags[target]}`);
      this.log();
    }

    if (!this.flags.dryrun) {
      exec(`npm dist-tag add ${pkg.name}@${tags[candidate]} ${target} --json`);
    }
  }
}
