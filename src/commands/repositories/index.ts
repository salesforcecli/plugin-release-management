/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { CliUx } from '@oclif/core';
import { RepositoryInfo, retrieveKnownRepositories } from '../../repositories';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'repositories', ['description', 'examples']);

export default class Repositories extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(EOL);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  public static readonly flagsConfig: FlagsConfig = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(CliUx.ux.table.flags() as any),
  };

  public async run(): Promise<RepositoryInfo[]> {
    const repositories = await retrieveKnownRepositories();

    if (!this.flags.json) {
      CliUx.ux.table(
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          printLine: this.log.bind(this),
          ...this.flags, // parsed flags
        }
      );
    }
    return repositories;
  }
}
