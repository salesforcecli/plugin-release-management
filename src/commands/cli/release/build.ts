/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { arrayWithDeprecation, Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { exec, ExecOptions, set } from 'shelljs';
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
    'start-from-npm-dist-tag': Flags.string({
      summary: messages.getMessage('flags.startFromNpmDistTag'),
      // default: 'latest-rc', // TODO: Will need to update this in GHA before next RC. `exactlyOne` does not work wellwith defaults
      char: 'd',
      aliases: ['rctag'],
      deprecateAliases: true,
      exactlyOne: ['start-from-npm-dist-tag', 'start-from-github-ref'],
    }),
    'start-from-github-ref': Flags.string({
      summary: messages.getMessage('flags.startFromGithubRef'),
      char: 'g',
      exactlyOne: ['start-from-npm-dist-tag', 'start-from-github-ref'],
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
      exclusive: ['prerelease'],
    }),
    prerelease: Flags.string({
      summary: messages.getMessage('flags.prerelease'),
      exclusive: ['patch'],
    }),
    snapshot: Flags.boolean({
      summary: messages.getMessage('flags.snapshot'),
    }),
    schema: Flags.boolean({
      summary: messages.getMessage('flags.schema'),
    }),
  };

  public async run(): Promise<void> {
    // I could not get the shelljs.exec config { fatal: true } to actually throw an error, but this works :shrug:
    set('-e');

    let auth: string;
    const { flags } = await this.parse(build);

    if (flags.prerelease === 'true' || flags.prerelease === 'false') {
      throw new SfError(
        'The prerelease flag is not a boolean. It should be the name of the prerelease tag, examples: dev, alpha, beta'
      );
    }

    const pushChangesToGitHub = !flags['build-only'];

    if (pushChangesToGitHub) {
      auth = ensureString(
        new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
        'The GH_TOKEN env var is required to push changes to GitHub. Use the --build-only flag to skip GitHub operations (a manual push will then be needed)'
      );
    }

    const { ['start-from-npm-dist-tag']: startFromNpmDistTag, ['start-from-github-ref']: startFromGithubRef } = flags;

    let ref: string;

    if (startFromGithubRef) {
      this.log(`Flag '--start-from-github-ref' passed, switching to '${startFromGithubRef}'`);

      ref = startFromGithubRef;
    } else {
      this.log(`Flag '--start-from-npm-dist-tag' passed, looking up version for ${startFromNpmDistTag}`);

      // Classes... I wish this was just a helper function.
      const temp = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });
      const version = temp.package.getDistTags(temp.package.packageJson.name)[startFromNpmDistTag];

      ref = version;
    }

    // Check out "starting point"
    // Works with sha (detached): "git checkout f476e8e"
    // Works with remote branch:  "git checkout my-branch"
    // Works with tag (detached): "git checkout 7.174.0"
    this.exec(`git checkout ${ref}`);

    const repo = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });

    // Get the current version for the "starting point"
    const currentVersion = repo.package.packageJson.version;

    // TODO: We might want to check and see if nextVersion exists
    // Determine the next version based on if --patch was passed in or if it is a prerelease
    const nextVersion = repo.package.determineNextVersion(flags.patch, flags.prerelease);
    repo.nextVersion = nextVersion;

    // Prereleases and patches need special branch prefixes to trigger GitHub Actions
    const branchPrefix = flags.patch ? 'patch/' : flags.prerelease ? 'prerelease/' : '';

    const branchName = `${branchPrefix}${nextVersion}`;

    this.log(`Starting from '${ref}' (${currentVersion}) and creating branch '${branchName}'`);

    // Create a new branch that matches the next version
    this.exec(`git switch -c ${branchName}`);

    if (flags.patch && pushChangesToGitHub) {
      // Since patches can be created from any previous dist-tag or github ref,
      // it is unlikely that we would be able to merge these into main.
      // Before we make any changes, push this branch to use as our PR `base`.
      // The build-patch.yml GHA will watch for merges into this branch to trigger a patch release
      // TODO: ^ update this GHA reference once it is decided

      this.exec(`git push -u origin ${branchName}`);
    }

    // bump the version in the pjson to the next version for this tag
    this.log(`Setting the version to ${nextVersion}`);
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
      this.exec(`git commit -m "chore(release): bump to ${nextVersion}"`);
      this.exec(`git push --set-upstream origin ${branchName} --no-verify`, { silent: false });

      const repoOwner = repo.package.packageJson.repository.split('/')[0];
      const repoName = repo.package.packageJson.repository.split('/')[1];

      // TODO: Review this after prerelease flow is solidified
      const prereleaseDetails =
        '\n**IMPORTANT:**\nPrereleases work differently than regular releases. Github Actions watches for branches prefixed with `prerelease/`. As long as the `package.json` contains a valid "prerelease tag" (1.2.3-dev.0), a new prerelease will be created for EVERY COMMIT pushed to that branch. If you would like to merge this PR into `main`, simply push one more commit that sets the version in the `package.json` to the version you\'d like to release.';

      // If it is a patch, we will set the PR base to the prefixed branch we pushed earlier
      // The Github Action will watch the `patch/` prefix for changes
      const base = flags.patch ? `${branchName}` : 'main';

      await octokit.request(`POST /repos/${repoOwner}/${repoName}/pulls`, {
        owner: repoOwner,
        repo: repoName,
        head: nextVersion,
        base,
        // TODO: Will need to update the "Tag kickoff" that is looking for this specific string
        title: `Release PR for ${nextVersion}`,
        body: `Building ${nextVersion} [skip-validate-pr]${flags.prerelease ? prereleaseDetails : ''}`,
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
