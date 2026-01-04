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
/* eslint-disable sf-plugin/command-example */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { ChangedPackageVersions, Package } from '../../../package.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.dependencies.pin');

export default class Pin extends SfCommand<ChangedPackageVersions> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    dryrun: Flags.boolean({
      char: 'd',
      default: false,
      summary: messages.getMessage('flags.dryrun.summary'),
    }),
    tag: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.tag.summary'),
      default: 'latest',
    }),
  };

  public async run(): Promise<ChangedPackageVersions> {
    const { flags } = await this.parse(Pin);
    const packageJson = await Package.create();
    const pkg = packageJson.pinDependencyVersions(flags.tag);

    if (flags.dryrun) {
      this.warn('Running in --dryrun mode. No changes will be written to the package.json.');
    } else {
      packageJson.writePackageJson();
    }

    this.table({
      data: pkg,
      columns: ['name', 'version', 'tag'],
    });
    return pkg;
  }
}
