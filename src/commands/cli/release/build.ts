/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { arrayWithDeprecation, Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { exec, ExecOptions } from 'shelljs';
import { ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { bold } from 'chalk';
import { Messages, SfError } from '@salesforce/core';
import { PackageRepo } from '../../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.release.build');

export default class build extends SfCommand<void> {
  public static readonly description = messages.getMessage('description');
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly aliases = ['cli:latestrc:build'];
  public static readonly flags = {
    base: Flags.string({
      summary: messages.getMessage('flags.base'),
      default: 'main',
    }),
    'rc-tag': Flags.string({
      summary: messages.getMessage('flags.rcTag'),
      default: 'latest-rc',
      aliases: ['rctag'],
      deprecateAliases: true,
    }),
    'build-only': Flags.boolean({
      summary: messages.getMessage('flags.buildOnly'),
      default: false,
    }),
    resolutions: Flags.boolean({
      summary: messages.getMessage('flags.resolutions'),
      default: true,
      allowNo: true,
    }),
    only: arrayWithDeprecation({
      summary: messages.getMessage('flags.only'),
    }),
    'pinned-deps': Flags.boolean({
      summary: messages.getMessage('flags.pinnedDeps'),
      default: true,
      allowNo: true,
    }),
    patch: Flags.boolean({
      summary: messages.getMessage('flags.patch'),
    }),
    snapshot: Flags.boolean({
      summary: messages.getMessage('flags.snapshot'),
    }),
    schema: Flags.boolean({
      summary: messages.getMessage('flags.schema'),
    }),
  };

  public async run(): Promise<void> {
    let auth: string;
    const { flags } = await this.parse(build);

    const pushChangesToGitHub = !flags['build-only'];

    if (pushChangesToGitHub) {
      auth = ensureString(
        new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
        'The GH_TOKEN env var is required to push changes to GitHub. Use the --build-only flag to skip GitHub operations (a manual push will then be needed)'
      );
    }

    const { ['rc-tag']: rcTag } = flags;

    const repo = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });

    // Get the current version for the passed in tag
    // Determine the next version based on if --patch was passed in or if it is a prerelease
    const [currentVersion, nextVersion] = repo.package.getVersionsForTag(rcTag, flags.patch);
    repo.nextVersion = nextVersion;

    this.log(`Starting on ${currentVersion} (${rcTag}) and creating branch ${repo.nextVersion}`);

    // Ensure we have a list of all tags pulled
    this.exec('git fetch --all --tags');
    // Start the rc build process on the current version for that tag
    // Also, create a new branch that matches the next version
    this.exec(`git checkout ${currentVersion} -b ${nextVersion}`);

    // bump the version in the pjson to the next version for this tag
    this.log(`setting the version to ${nextVersion}`);
    repo.package.setNextVersion(nextVersion);
    repo.package.packageJson.version = nextVersion;

    if (flags.only) {
      this.log(`bumping the following dependencies only: ${flags.only.join(', ')}`);
      const bumped = repo.package.bumpDependencyVersions(flags.only);

      if (!bumped.length) {
        throw new SfError(
          'No version changes made. Confirm you are passing the correct dependency and version to --only.'
        );
      }
    } else {
      // bump resolution deps
      if (flags.resolutions) {
        this.log('bumping resolutions in the package.json to their "latest"');
        repo.package.bumpResolutions('latest');
      }

      // pin the pinned dependencies
      if (flags['pinned-deps']) {
        this.log('pinning dependencies in pinnedDependencies to "latest-rc"');
        repo.package.pinDependencyVersions('latest-rc');
      }
    }
    repo.package.writePackageJson();

    this.exec('yarn install');
    // streamline the lockfile
    this.exec('npx yarn-deduplicate');

    if (flags.snapshot) {
      this.log('updating snapshots');
      this.exec(`./bin/${repo.name === 'sfdx-cli' ? 'dev.sh' : 'dev'} snapshot:generate`, { silent: false });
    }

    if (flags.schema) {
      this.log('updating schema');
      this.exec('sf-release cli:schemas:collect', { silent: false });
    }

    if (pushChangesToGitHub) {
      const octokit = new Octokit({ auth });

      await this.maybeSetGitConfig(octokit);

      // commit package.json/yarn.lock and potentially command-snapshot changes
      this.exec('git add .');
      this.exec(`git commit -m "chore(${rcTag}): bump to ${nextVersion}"`);
      this.exec(`git push --set-upstream origin ${nextVersion} --no-verify`, { silent: false });

      const repoOwner = repo.package.packageJson.repository.split('/')[0];
      const repoName = repo.package.packageJson.repository.split('/')[1];

      await octokit.request(`POST /repos/${repoOwner}/${repoName}/pulls`, {
        owner: repoOwner,
        repo: repoName,
        head: nextVersion,
        base: flags.base,
        title: `Release v${nextVersion} as ${rcTag}`,
        body: `Building ${rcTag} [skip-validate-pr]`,
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
