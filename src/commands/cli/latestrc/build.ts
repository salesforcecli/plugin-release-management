/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { exec, ExecOptions } from 'shelljs';
import { ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { bold } from 'chalk';
import { Messages } from '@salesforce/core';
import { SinglePackageRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.latestrc.build');

export default class build extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    rctag: flags.string({
      description: messages.getMessage('flags.rctag'),
      default: 'latest-rc',
    }),
  };
  public async run(): Promise<void> {
    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );
    // get the current version and implement the patch version for a default rc build
    const repo = await SinglePackageRepo.create({ ux: this.ux });

    const nextRCVersion = repo.package.getNextRCVersion(this.flags.rctag);
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

    this.exec('yarn install');

    this.exec('yarn snapshot-generate');

    // commit package.json/yarn.lock and potentially command-snapshot changes
    this.exec('git add .');
    this.exec(`git commit -m "chore(latest-rc): bump to ${nextRCVersion}"`);
    this.exec(`git push --set-upstream origin ${nextRCVersion}`);

    const repoOwner = repo.package.packageJson.repository.split('/')[0];
    const repoName = repo.package.packageJson.repository.split('/')[1];

    const octokit = new Octokit({ auth });
    await octokit.request(`POST /repos/${repoOwner}/${repoName}/pulls`, {
      owner: repoOwner,
      repo: repoName,
      head: nextRCVersion,
      base: 'main',
      title: `Release v${nextRCVersion} as latest-rc`,
      body: 'Building latest-rc @W-0@',
    });
  }

  private exec(cmd: string, options: ExecOptions = { silent: true }): void {
    this.log(bold(cmd));
    exec(cmd, options);
  }
}
