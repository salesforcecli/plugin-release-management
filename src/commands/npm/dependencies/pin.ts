/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

    this.table(pkg, {
      name: { header: 'Name' },
      version: { header: 'Version' },
      tag: { header: 'Tag' },
      alias: { header: 'Alias' },
    });

    return pkg;
  }
}
