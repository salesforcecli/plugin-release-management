/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
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

export default class Validate extends SfCommand<Response> {
  public static readonly summary =
    'inspects the git commits to see if there are any commits that will warrant a new release';
  public static readonly description =
    'inspects the git commits to see if there are any commits that will warrant a new release';

  public static readonly flags = {
    verbose: Flags.boolean({
      summary: 'show all commits for all packages (only works with --json flag)',
    }),
  };

  public async run(): Promise<Response> {
    const { flags } = await this.parse(Validate);
    const packages = [await Package.create()];
    const responses = await Promise.all(
      packages.map(async (pkg) => ({
        ...(await inspectCommits(pkg)),
        name: pkg.name,
        currentVersion: pkg.packageJson.version,
      }))
    );

    const majorBump = responses.some((resp) => !!resp.isMajorBump);
    if (majorBump) {
      throw new SfError(
        'Major version bump detected. You must manually update the version in the package.json to release a new major version.',
        'MajorBumpDetected'
      );
    }
    const shouldRelease = responses.some((resp) => !!resp.shouldRelease) && !majorBump;
    this.log(shouldRelease.toString());
    return flags.verbose ? { shouldRelease, majorBump, packages: responses } : { shouldRelease, majorBump };
  }
}
