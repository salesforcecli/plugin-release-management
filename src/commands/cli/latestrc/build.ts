/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxCommand } from '@salesforce/command';
import { exec, ExecOptions } from 'shelljs';
import { ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { bold } from 'chalk';
import { SinglePackageRepo } from '../../../repository';

export default class build extends SfdxCommand {
  public async run(): Promise<void> {
    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );
    // get the current version and implement the patch version for a default rc build
    const repo = await SinglePackageRepo.create({ ux: this.ux });

    const nextRCVersion = repo.package.getNextRCVersion();
    repo.nextVersion = nextRCVersion;

    this.ux.log(`starting on main and will checkout ${repo.nextVersion}`);

    // start the latest-rc build process on a clean main branch
    this.exec('git checkout main');
    this.exec('git pull');
    this.exec(`git checkout -b ${nextRCVersion}`);

    // bump the version in the pjson to the new latest-rc
    this.ux.log(`setting the version to ${nextRCVersion}`);
    repo.package.setNextVersion(nextRCVersion);
    repo.package.packageJson.version = nextRCVersion;

    // bump resolution deps
    this.ux.log('bumping resolutions in the package.json to their "latest"');
    repo.package.bumpResolutions('latest');

    // pin the pinned dependencies
    this.ux.log('pinning dependencies in pinnedDependencies to "latest-rc"');
    repo.package.pinDependencyVersions('latest-rc');
    repo.package.writePackageJson();

    // compare the command-snapshot and regenerate if they're changes, they'll be part of the PR
    try {
      this.exec('yarn snapshot-compare', { fatal: true, silent: true });
    } catch {
      this.exec('yarn snapshot-generate');
    }

    this.exec('yarn install');

    // commit package.json/yarn.lock and potentially command-snapshot changes
    this.exec('git add .');
    this.exec(`git commit -m "chore(latest-rc): bump to ${nextRCVersion}"`);
    this.exec(`git push --set-upstream origin ${nextRCVersion}`);

    const octokit = new Octokit({ auth });
    await octokit.request('POST /repos/salesforcecli/sfdx-cli/pulls', {
      owner: 'salesforcecli',
      repo: 'sfdx-cli',
      head: nextRCVersion,
      base: 'main',
      title: `Release v${nextRCVersion} as latest-rc`,
      body: 'Building latest-rc',
    });
  }

  private exec(cmd: string, options: ExecOptions = { silent: true }): void {
    this.log(bold(cmd));
    exec(cmd, options);
  }
}
