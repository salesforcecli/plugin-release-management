/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { promisify } from 'node:util';
import { exec as execSync, ExecException } from 'child_process';
import { arrayWithDeprecation, Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { Messages, SfError } from '@salesforce/core';
import { PackageRepo } from '../../../repository';

const exec = promisify(execSync);

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.release.build');

export default class build extends SfCommand<void> {
  public static readonly description = messages.getMessage('description');
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['cli:latestrc:build'];
  public static readonly flags = {
    'start-from-npm-dist-tag': Flags.string({
      summary: messages.getMessage('flags.startFromNpmDistTag'),
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
    'release-channel': Flags.string({
      summary: messages.getMessage('flags.releaseChannel'),
      char: 'c',
      required: true,
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
    jit: Flags.boolean({
      summary: messages.getMessage('flags.jit'),
      default: true,
      allowNo: true,
    }),
    label: Flags.string({
      summary: messages.getMessage('flags.label'),
      multiple: true,
    }),
    patch: Flags.boolean({
      summary: messages.getMessage('flags.patch'),
    }),
  };

  /* eslint-disable complexity */
  public async run(): Promise<void> {
    const { flags } = await this.parse(build);

    const pushChangesToGitHub = !flags['build-only'];

    const isPrerelease = !['latest', 'latest-rc', 'nightly'].includes(flags['release-channel']);

    if (isPrerelease) {
      this.log(
        `NOTE: The release channel '${flags['release-channel']}' is not one of 'latest', 'latest-rc', 'nightly'. It will released as a prerelease.`
      );
    }

    const auth = pushChangesToGitHub
      ? ensureString(
          new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
          'The GH_TOKEN env var is required to push changes to GitHub. Use the --build-only flag to skip GitHub operations (a manual push will then be needed)'
        )
      : undefined;

    const ref = await this.getGithubRef(flags['start-from-github-ref'], flags['start-from-npm-dist-tag']);

    // Check out "starting point"
    // Works with sha (detached): "git checkout f476e8e"
    // Works with remote branch:  "git checkout my-branch"
    // Works with tag (detached): "git checkout 7.174.0"
    await this.exec(`git checkout ${ref}`);

    const repo = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });

    // Get the current version for the "starting point"
    const currentVersion = repo.package.packageJson.version;

    // TODO: We might want to check and see if nextVersion exists in npm
    // Determine the next version based on if --patch was passed in or if it is a prerelease
    const nextVersion = repo.package.determineNextVersion(
      flags.patch,
      isPrerelease ? flags['release-channel'] : undefined
    );
    repo.nextVersion = nextVersion;

    // Prereleases and patches need special branch prefixes to trigger GitHub Actions
    const branchPrefix = flags.patch ? 'patch/' : isPrerelease ? 'prerelease/' : '';

    const branchName = `${branchPrefix}${nextVersion}`;

    // Ensure branch does not already exist on the remote (origin)
    // We only look at remote branches since they are likely generated
    // We do not want to delete a locally built `cli:release:build` branch
    if (pushChangesToGitHub && (await this.exec(`git ls-remote --heads origin ${branchName}`))) {
      await this.exec(`git push origin --delete ${branchName}`);
    }

    this.log(`Starting from '${ref}' (${currentVersion}) and creating branch '${branchName}'`);

    // Create a new branch that matches the next version
    await this.exec(`git switch -c ${branchName}`);

    // bump the version in the pjson to the next version for this tag
    this.log(`Setting the version to ${nextVersion}`);
    repo.package.setNextVersion(nextVersion);
    repo.package.packageJson.version = nextVersion;

    if (flags.only) {
      this.log(`Bumping the following dependencies only: ${flags.only.join(', ')}`);
      const bumped = repo.package.bumpDependencyVersions(flags.only);

      if (!bumped.length) {
        throw new SfError(
          'No version changes made. Confirm you are passing the correct dependency and version to --only.'
        );
      }
    } else {
      // bump resolution deps
      if (flags.resolutions) {
        this.log('Bumping resolutions in the package.json to their "latest"');
        repo.package.bumpResolutions('latest');
      }

      // pin the pinned dependencies
      if (flags['pinned-deps']) {
        this.log('Pinning dependencies in pinnedDependencies to "latest-rc"');
        repo.package.pinDependencyVersions('latest-rc');
      }

      if (flags.jit) {
        this.log('Bumping just-in-time plugins to "latest-rc"');
        repo.package.bumpJit('latest-rc');
      }
    }
    repo.package.writePackageJson();

    // Run an install to generate the lock file (skip all pre/post scripts)
    await this.exec('yarn install --ignore-scripts');
    // Remove duplicates in the lockfile
    await this.exec('npx yarn-deduplicate');
    // Run an install with deduplicated dependencies (with scripts)
    await this.exec('yarn install');

    this.log('Updates complete');

    if (pushChangesToGitHub) {
      const octokit = new Octokit({ auth });

      await this.maybeSetGitConfig(octokit);

      // commit package.json/yarn.lock and potentially command-snapshot changes
      await this.exec('git add .');
      await this.exec(`git commit -m "chore(release): bump to ${nextVersion}"`);
      await this.exec(`git push --set-upstream origin ${branchName} --no-verify`);

      const [repoOwner, repoName] = repo.package.packageJson.repository.split('/');

      const releaseDetails = `
> **Note**
> Patches and prereleases often require very specific starting points and changes.
> These changes cannot always be shipped from \`main\` since it is likely ahead in commits.
> Because of this the release process is slightly different, they "ship" from the PR itself.
> Once your PR is ready to be released, add the "release-it" label.`;

      const includeReleaseDetails = isPrerelease || (flags.patch && flags['release-channel'] !== 'nightly');

      const pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: repoOwner,
        repo: repoName,
        head: branchName,
        base: 'main',
        title: `Release PR for ${nextVersion} as ${flags['release-channel']}`,
        body: `Building ${nextVersion}\n[skip-validate-pr]\n${includeReleaseDetails ? releaseDetails : ''}`,
      });

      if (flags.label) {
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
          owner: repoOwner,
          repo: repoName,
          // eslint-disable-next-line camelcase
          issue_number: pr.data.number,
          labels: flags.label,
        });
      }
    }
  }

  private async getGithubRef(githubRef: string, distTag: string): Promise<string> {
    let ref: string;
    if (githubRef) {
      this.log(`Flag '--start-from-github-ref' passed, switching to '${githubRef}'`);

      ref = githubRef;
    } else {
      this.log(`Flag '--start-from-npm-dist-tag' passed, looking up version for ${distTag}`);

      const temp = await PackageRepo.create({ ux: new Ux({ jsonEnabled: this.jsonEnabled() }) });
      const version = temp.package.getDistTags(temp.package.packageJson.name)[distTag];
      ref = version;
    }

    return ref;
  }

  private async exec(command: string, silent = false): Promise<string> {
    try {
      const { stdout } = await exec(command);

      if (!silent) {
        this.styledHeader(command);
        this.log(stdout);
      }

      return stdout;
    } catch (err) {
      // An error will throw before `stdout` is able to be log above. The child_process.exec adds stdout and stderr to the error object
      const error = err as ExecException & {
        stdout: string;
        stderr: string;
      };

      this.log(error.stdout);

      throw new SfError((err as Error).message);
    }
  }

  private async maybeSetGitConfig(octokit: Octokit): Promise<void> {
    const username = await this.exec('git config user.name', true);
    const email = await this.exec('git config user.email', true);
    if (!username || !email) {
      const user = await octokit.request('GET /user');
      if (!username) await this.exec(`git config user.name "${user.data.name}"`);
      if (!email) await this.exec(`git config user.email "${user.data.email}"`);
    }
  }
}
