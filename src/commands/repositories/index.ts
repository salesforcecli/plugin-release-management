/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable sf-plugin/no-hardcoded-messages-flags */

import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { RepositoryInfo, retrieveKnownRepositories } from '../../repositories.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'repositories');

export type RepositoryResult = RepositoryInfo[];
export default class Repositories extends SfCommand<RepositoryResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    columns: Flags.string({
      summary: messages.getMessage('flags.columns.summary'),
      exclusive: ['extended'],
    }),
    csv: Flags.boolean({
      summary: messages.getMessage('flags.csv.summary'),
      exclusive: ['no-truncate'],
    }),
    extended: Flags.boolean({
      char: 'x',
      summary: messages.getMessage('flags.extended.summary'),
      exclusive: ['columns'],
    }),
    filter: Flags.string({
      summary: messages.getMessage('flags.filter.summary'),
    }),
    'no-header': Flags.boolean({
      summary: messages.getMessage('flags.no-header.summary'),
      exclusive: ['csv'],
    }),
    'no-truncate': Flags.boolean({
      summary: messages.getMessage('flags.no-truncate.summary'),
      exclusive: ['csv'],
    }),
    output: Flags.string({
      summary: messages.getMessage('flags.output.summary'),
      exclusive: ['no-truncate', 'csv'],
      options: ['csv', 'json', 'yaml'],
    }),
    sort: Flags.string({
      summary: messages.getMessage('flags.sort.summary'),
    }),
  };

  public async run(): Promise<RepositoryResult> {
    const { flags } = await this.parse(Repositories);
    const repositories = await retrieveKnownRepositories();
    const ux = new Ux({ jsonEnabled: flags.json ?? false });

    ux.table(
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

    return repositories;
  }
}
