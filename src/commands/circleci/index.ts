/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { retrieveKnownRepositories } from '../../repositories';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'circleci', [
  'list.description',
  'list.examples',
  'list.flags.type',
]);

export default class CircleCI extends SfdxCommand {
  public static readonly description = messages.getMessage('list.description');
  public static readonly examples = messages.getMessage('list.examples').split(EOL);

  public static readonly flagsConfig: FlagsConfig = {
    'contains-package-type': flags.enum({
      description: messages.getMessage('list.flags.type'),
      char: 't',
      options: ['plugin', 'library', 'orb'],
    }),
  };

  public async run(): Promise<string[]> {
    let repositories = await retrieveKnownRepositories();

    if (this.flags['contains-package-type']) {
      const packageType = this.flags['contains-package-type'] as string;
      repositories = repositories.filter((repository) => repository.packages.find((pkg) => pkg.type === packageType));
    }

    const slugs = repositories.map((plugin) => `gh/${/https:\/\/github.com\/([\w_-]+\/[\w_-]+)/.exec(plugin.url)[1]}`);
    this.ux.log(slugs.join('\n'));
    return slugs;
  }
}
