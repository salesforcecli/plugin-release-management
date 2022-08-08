/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import { Package } from '../../../package';
import { CommitInspection, inspectCommits } from '../../../inspectCommits';

type PackageCommits = CommitInspection & {
  name: string;
  currentVersion: string;
};

type Response = {
  shouldRelease: boolean;
  majorBump: boolean;
  packages?: PackageCommits[];
};

export default class Validate extends SfdxCommand {
  public static readonly description =
    'inspects the git commits to see if there are any commits that will warrant a new release';
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: 'show all commits for all packages (only works with --json flag)',
    }),
  };

  public async run(): Promise<Response> {
    const packages = [await Package.create()];
    const responses: PackageCommits[] = [];
    for (const pkg of packages) {
      const commitInspection = await inspectCommits(pkg);
      const response = Object.assign(commitInspection, {
        name: pkg.name,
        currentVersion: pkg.packageJson.version,
      });
      responses.push(response);
    }
    const majorBump = responses.some((resp) => !!resp.isMajorBump);
    if (majorBump) {
      throw new SfdxError(
        'Major version bump detected. You must manually update the version in the package.json to release a new major version.',
        'MajorBumpDetected'
      );
    }
    const shouldRelease = responses.some((resp) => !!resp.shouldRelease) && !majorBump;
    this.ux.log(shouldRelease.toString());
    return this.flags.verbose ? { shouldRelease, majorBump, packages: responses } : { shouldRelease, majorBump };
  }
}
