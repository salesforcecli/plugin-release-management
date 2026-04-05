/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

    ux.table({
      data: repositories.map((s) => ({
        organization: s.organization,
        name: s.name,
        url: s.url,
        packages: s.packages.map((pkg) => `${pkg.type} ${pkg.name}`).join('\n'),
        ...flags, // parsed flags
      })),
    });
    return repositories;
  }
}
