/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { exec, ExecOptions } from 'shelljs';
import { ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { bold } from 'chalk';
import { Messages, SfError } from '@salesforce/core';
import { PackageRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.latestrc.build');

export default class build extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    rctag: flags.string({
      description: messages.getMessage('flags.rctag'),
      default: 'latest-rc',
    }),
    'build-only': flags.boolean({
      description: messages.getMessage('flags.buildOnly'),
      default: false,
    }),
    resolutions: flags.boolean({
      description: messages.getMessage('flags.resolutions'),
      default: true,
      allowNo: true,
    }),
    only: flags.array({
      description: messages.getMessage('flags.only'),
    }),
    'pinned-deps': flags.boolean({
      description: messages.getMessage('flags.pinnedDeps'),
      default: true,
      allowNo: true,
    }),
    patch: flags.boolean({
      description: messages.getMessage('flags.patch'),
    }),
    snapshot: flags.boolean({
      description: messages.getMessage('flags.snapshot'),
    }),
    schema: flags.boolean({
      description: messages.getMessage('flags.schema'),
    }),
  };

  public async run(): Promise<void> {
    let auth: string;

    const pushChangesToGitHub = !this.flags['build-only'];

    if (pushChangesToGitHub) {
      auth = ensureString(
        new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
        'The GH_TOKEN env var is required to push changes to GitHub. Use the --build-only flag to skip GitHub operations (a manual push will then be needed)'
      );
    }

    // get the current version and implement the patch version for a default rc build
    const repo = await PackageRepo.create({ ux: this.ux });

    const nextRCVersion = repo.package.getNextRCVersion(this.flags.rctag, this.flags.patch);
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

    const only = this.flags.only as string[];

    if (only) {
      this.ux.log(`bumping the following dependencies only: ${only.join(', ')}`);
      const bumped = repo.package.bumpDependencyVersions(only);

      if (!bumped.length) {
        throw new SfError(
          'No version changes made. Confirm you are passing the correct dependency and version to --only.'
        );
      }
    } else {
      // bump resolution deps
      if (this.flags.resolutions) {
        this.ux.log('bumping resolutions in the package.json to their "latest"');
        repo.package.bumpResolutions('latest');
      }

      // pin the pinned dependencies
      if (this.flags['pinned-deps']) {
        this.ux.log('pinning dependencies in pinnedDependencies to "latest-rc"');
        repo.package.pinDependencyVersions('latest-rc');
      }
    }
    repo.package.writePackageJson();

    this.exec('yarn install');
    // streamline the lockfile
    this.exec('npx yarn-deduplicate');

    if (this.flags.snapshot) {
      this.ux.log('updating snapshots');
      this.exec('./bin/run snapshot:generate', { silent: false });
    }

    if (this.flags.schema) {
      this.ux.log('updating schema');
      this.exec('./bin/run cli:schemas:collect', { silent: false });
    }

    if (pushChangesToGitHub) {
      const octokit = new Octokit({ auth });

      await this.maybeSetGitConfig(octokit);

      // commit package.json/yarn.lock and potentially command-snapshot changes
      this.exec('git add .');
      this.exec(`git commit -m "chore(latest-rc): bump to ${nextRCVersion}"`);
      this.exec(`git push --set-upstream origin ${nextRCVersion} --no-verify`, { silent: false });

      const repoOwner = repo.package.packageJson.repository.split('/')[0];
      const repoName = repo.package.packageJson.repository.split('/')[1];

      await octokit.request(`POST /repos/${repoOwner}/${repoName}/pulls`, {
        owner: repoOwner,
        repo: repoName,
        head: nextRCVersion,
        base: 'main',
        title: `Release v${nextRCVersion} as latest-rc`,
        body: 'Building latest-rc [skip-validate-pr]',
      });
    }
  }

  private exec(cmd: string, options: ExecOptions = { silent: true }): void {
    this.log(bold(cmd));
    exec(cmd, options);
  }

  private async maybeSetGitConfig(octokit: Octokit): Promise<void> {
    const username = exec('git config user.name', { silent: true }).stdout.trim();
    const email = exec('git config user.email', { silent: true }).stdout.trim();
    if (!username || !email) {
      const user = await octokit.request('GET /user');
      if (!username) this.exec(`git config user.name "${user.data.name}"`);
      if (!email) this.exec(`git config user.email "${user.data.email}"`);
    }
  }
}
