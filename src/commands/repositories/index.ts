/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { cli } from 'cli-ux';
import { RepositoryInfo, retrieveKnownRepositories } from '../../repositories';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'repositories');

export default class Repositories extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(EOL);

  public static readonly flagsConfig: FlagsConfig = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(cli.table.flags() as any),
  };

  public async run(): Promise<RepositoryInfo[]> {
    const repositories = await retrieveKnownRepositories();

    if (!this.flags.json) {
      cli.table(
        repositories,
        {
          organization: {},
          name: {},
          url: {},
          packages: {
            get: (row: RepositoryInfo): string => row.packages.map((pkg) => `${pkg.type} ${pkg.name}`).join('\n'),
            extended: true,
          },
        },
        {
          printLine: this.log.bind(this),
          ...this.flags, // parsed flags
        }
      );
    }
    return repositories;
  }
}
