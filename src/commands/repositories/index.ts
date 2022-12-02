/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { CliUx } from '@oclif/core';
import { RepositoryInfo, retrieveKnownRepositories } from '../../repositories';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'repositories');

export default class Repositories extends SfCommand<RepositoryInfo[]> {
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(EOL);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  public static readonly flags = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(CliUx.ux.table.flags() as any),
  };

  public async run(): Promise<RepositoryInfo[]> {
    const { flags } = await this.parse(Repositories);
    const repositories = await retrieveKnownRepositories();

    if (!flags.json) {
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
          ...flags, // parsed flags
        }
      );
    }
    return repositories;
  }
}
