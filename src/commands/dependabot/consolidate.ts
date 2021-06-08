/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { fs, Messages } from '@salesforce/core';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { diff, ReleaseType } from 'semver';
import { bold, cyan, green } from 'chalk';
import { exec } from 'shelljs';
import { ensureString, isString } from '@salesforce/ts-types';
import { PackageJson } from '../../package';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.consolidate');

export type BumpType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>;

export default class Consolidate extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    'max-version-bump': flags.enum({
      description: messages.getMessage('maxVersionBump'),
      char: 'm',
      options: ['major', 'minor', 'patch'],
      default: 'minor',
      required: true,
    }),
    'base-branch': flags.string({
      description: messages.getMessage('baseBranch'),
      char: 'b',
      default: 'main',
      required: true,
    }),
    'target-branch': flags.string({
      description: messages.getMessage('targetBranch'),
      char: 't',
      default: 'consolidate-dependabot',
      required: true,
    }),
    ignore: flags.array({
      description: messages.getMessage('ignore'),
      default: [],
    }),
    dryrun: flags.boolean({
      description: messages.getMessage('dryrun'),
      char: 'd',
      default: false,
    }),
    'no-pr': flags.boolean({
      description: messages.getMessage('noPR'),
      default: false,
    }),
    owner: flags.string({
      description: messages.getMessage('owner'),
      char: 'o',
    }),
    repo: flags.string({
      description: messages.getMessage('repo'),
      char: 'r',
    }),
  };

  public async run(): Promise<void> {
    const { owner, repo } = await this.getOwnerAndRepo();
    const baseBranch = ensureString(this.flags['base-branch']);
    const targetBranch = ensureString(this.flags['target-branch']);
    const auth = ensureString(new Env().getString('GH_TOKEN'), 'GH_TOKEN is required to be set in the environment');

    const octokit = new Octokit({ auth });
    const pullRequests = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
    });

    const dependabotPRs = pullRequests.data.filter(
      (d) =>
        d.state === 'open' &&
        d.user.login === 'dependabot[bot]' &&
        this.meetsVersionCriteria(d.title) &&
        !this.shouldBeIgnored(d.title)
    );

    let prBody = `This PR consolidates all dependabot PRs that are less than or equal to a ${
      this.flags['max-version-bump'] as string
    } version bump${os.EOL}${os.EOL}`;
    for (const pr of dependabotPRs) {
      prBody += `Closes #${pr.number}${os.EOL}`;
    }

    const prTitle = `Consolidate ${this.flags['max-version-bump'] as string} dependabot PRs`;

    this.log(bold('PR Title:'));
    this.log(prTitle);
    this.log(bold('PR Body:'));
    this.log(prBody);

    this.log(bold('Commits:'));
    for (const pr of dependabotPRs) {
      this.log(`  ${cyan(pr.head.sha)} [#${pr.number} ${pr.title}]`);
    }

    if (!this.flags.dryrun) {
      try {
        this.exec('git fetch origin');
        this.exec('git fetch -p');
        this.exec(`git checkout ${baseBranch}`);
        this.exec('git pull');
        this.exec(`git checkout -b ${targetBranch}`);

        const shas = dependabotPRs.map((d) => d.head.sha);
        for (const sha of shas) {
          this.exec(`git cherry-pick ${sha} --strategy-option=theirs`);
        }

        if (!this.flags['no-pr']) {
          this.exec(`git push -u origin ${targetBranch} --no-verify`);
          const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            head: targetBranch,
            base: baseBranch,
            body: prBody,
            title: prTitle,
          });

          this.log();
          // eslint-disable-next-line no-underscore-dangle
          this.log(`${green('Created Pull Request:')} ${response.data._links.html.href}`);
        }
      } catch (err) {
        this.error(err);
      }
    }
  }

  private async getOwnerAndRepo(): Promise<{ owner: string; repo: string }> {
    const pkgJson = (await fs.readJson('package.json')) as PackageJson;
    if (pkgJson.repository && isString(pkgJson.repository)) {
      const [owner, repo] = pkgJson.repository?.split('/');
      return { owner, repo };
    } else {
      return {
        owner: ensureString(this.flags.owner, 'You must specify an owner'),
        repo: ensureString(this.flags.repo, 'You must specify a respository'),
      };
    }
  }

  private meetsVersionCriteria(title: string): boolean {
    const versionsRegex = /[0-9]+.[0-9]+.[0-9]+/g;
    const [from, to] = title.match(versionsRegex);

    const bumpType = diff(from, to) as BumpType;
    const inclusionMap = {
      major: ['major', 'minor', 'patch'] as BumpType[],
      minor: ['minor', 'patch'] as BumpType[],
      patch: ['patch'] as BumpType[],
    };

    const maxVersionBump = this.flags['max-version-bump'] as BumpType;
    const includeBumps = inclusionMap[maxVersionBump];
    return includeBumps.includes(bumpType);
  }

  private shouldBeIgnored(title: string): boolean {
    const ignore = this.flags.ignore as string[];
    return ignore.some((i) => title.includes(i));
  }

  private exec(cmd: string, silent = false): void {
    this.log(bold(cmd));
    exec(cmd, { silent });
  }
}
