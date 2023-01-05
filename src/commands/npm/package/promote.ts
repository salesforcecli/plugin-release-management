/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { exec } from 'shelljs';
import { bold } from 'chalk';
import { PackageRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.package.promote');

interface Token {
  token: string;
  key: string;
  readonly: boolean;
  automation: boolean;
}

export default class Promote extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    dryrun: Flags.boolean({
      char: 'd',
      default: false,
      summary: messages.getMessage('dryrun'),
    }),
    target: Flags.string({
      char: 't',
      default: 'latest',
      summary: messages.getMessage('target'),
    }),
    candidate: Flags.string({
      char: 'c',
      summary: messages.getMessage('candidate'),
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Promote);
    const pkg = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });
    await pkg.writeNpmToken();

    const token = ensureString(new Env().getString('NPM_TOKEN'), 'NPM_TOKEN must be set in the environment');
    const tokens = JSON.parse(exec('npm token list --json', { silent: true }).stdout) as Token[];
    const publishTokens = tokens.filter((t) => t.readonly === false && t.automation === false);
    const match = publishTokens.find((t) => token.startsWith(t.token));

    if (!match) {
      const errType = 'InvalidToken';
      throw new SfError(messages.getMessage(errType), errType);
    }

    const tags = pkg.package.npmPackage['dist-tags'];
    const candidate = ensureString(flags.candidate);
    const target = ensureString(flags.target);

    if (!tags[candidate]) {
      const errType = 'InvalidTag';
      throw new SfError(messages.getMessage(errType, [candidate]), errType);
    }

    this.log(`Promoting ${pkg.name}@${tags[candidate]} from ${bold(candidate)} to ${bold(target)}`);
    if (target) {
      this.warn(`This will overwrite the existing ${target} version: ${tags[target]}`);
      this.log();
    }

    if (!flags.dryrun) {
      exec(`npm dist-tag add ${pkg.name}@${tags[candidate]} ${target} --json`);
    }
  }
}
