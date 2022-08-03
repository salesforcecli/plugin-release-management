/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { ChangedPackageVersions, Package } from '../../../package';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'npm.dependencies.pin', [
  'description',
  'flags.dryrun',
  'flags.tag',
]);

export default class Pin extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    dryrun: flags.boolean({
      char: 'd',
      default: false,
      description: messages.getMessage('flags.dryrun'),
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('flags.tag'),
      default: 'latest',
    }),
  };

  public async run(): Promise<ChangedPackageVersions> {
    const packageJson = await Package.create();
    const pkg = packageJson.pinDependencyVersions(this.flags.tag);

    if (this.flags.dryrun) {
      this.warn('Running in --dryrun mode. No changes will be written to the package.json.');
    } else {
      packageJson.writePackageJson();
    }

    this.ux.table(pkg, {
      name: { header: 'Name' },
      version: { header: 'Version' },
      tag: { header: 'Tag' },
      alias: { header: 'Alias' },
    });

    return pkg;
  }
}
