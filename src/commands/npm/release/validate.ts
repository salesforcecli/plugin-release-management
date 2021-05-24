/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { isMonoRepo, LernaRepo } from '../../../repository';
import { Package } from '../../../package';
import { CommitInspection, inspectCommits } from '../../../inspectCommits';

type PackageCommits = CommitInspection & {
  name: string;
  currentVersion: string;
};

type Response = {
  shouldRelease: boolean;
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
    const isLerna = await isMonoRepo();
    const packages = isLerna ? await LernaRepo.getPackages() : [await Package.create()];
    const responses: PackageCommits[] = [];
    for (const pkg of packages) {
      const commitInspection = await inspectCommits(pkg, isLerna);
      const response = Object.assign(commitInspection, {
        name: pkg.name,
        currentVersion: pkg.packageJson.version,
      });
      responses.push(response);
    }
    const shouldRelease = responses.some((resp) => !!resp.shouldRelease);
    this.ux.log(shouldRelease.toString());
    return this.flags.verbose ? { shouldRelease, packages: responses } : { shouldRelease };
  }
}
