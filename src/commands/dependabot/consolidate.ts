/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { bold, cyan, green } from 'chalk';
import { exec } from 'shelljs';
import { ensureString } from '@salesforce/ts-types';
import { meetsVersionCriteria, maxVersionBumpFlag, getOwnerAndRepo, BumpType } from '../../dependabot';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.consolidate');

export default class Consolidate extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flags = {
    'max-version-bump': maxVersionBumpFlag,
    'base-branch': Flags.string({
      summary: messages.getMessage('baseBranch'),
      char: 'b',
      default: 'main',
      required: true,
    }),
    'target-branch': Flags.string({
      summary: messages.getMessage('targetBranch'),
      char: 't',
      default: 'consolidate-dependabot',
      required: true,
    }),
    ignore: Flags.string({
      summary: messages.getMessage('ignore'),
      multiple: true,
    }),
    dryrun: Flags.boolean({
      summary: messages.getMessage('dryrun'),
      char: 'd',
      default: false,
    }),
    'no-pr': Flags.boolean({
      summary: messages.getMessage('noPR'),
      default: false,
    }),
    owner: Flags.string({
      summary: messages.getMessage('owner'),
      char: 'o',
    }),
    repo: Flags.string({
      summary: messages.getMessage('repo'),
      char: 'r',
      dependsOn: ['owner'],
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Consolidate);
    const baseRepoObject = await getOwnerAndRepo(flags.owner, flags.repo);
    const baseBranch = ensureString(flags['base-branch']);
    const targetBranch = ensureString(flags['target-branch']);
    const auth = ensureString(new Env().getString('GH_TOKEN'), 'GH_TOKEN is required to be set in the environment');

    const octokit = new Octokit({ auth });
    const pullRequests = await octokit.request('GET /repos/{owner}/{repo}/pulls', baseRepoObject);

    const dependabotPRs = pullRequests.data.filter(
      (d) =>
        d.state === 'open' &&
        d.user.login === 'dependabot[bot]' &&
        meetsVersionCriteria(d.title, flags['max-version-bump'] as BumpType) &&
        !flags.ignore.some((i) => d.title.includes(i))
    );

    let prBody = `This PR consolidates all dependabot PRs that are less than or equal to a ${flags['max-version-bump']} version bump${os.EOL}${os.EOL}`;
    for (const pr of dependabotPRs) {
      prBody += `Closes #${pr.number}${os.EOL}`;
    }

    const prTitle = `Consolidate ${flags['max-version-bump']} dependabot PRs`;

    this.log(bold('PR Title:'));
    this.log(prTitle);
    this.log(bold('PR Body:'));
    this.log(prBody);

    this.log(bold('Commits:'));
    for (const pr of dependabotPRs) {
      this.log(`  ${cyan(pr.head.sha)} [#${pr.number} ${pr.title}]`);
    }

    if (!flags.dryrun) {
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

        if (!flags['no-pr']) {
          this.exec(`git push -u origin ${targetBranch} --no-verify`);
          const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            ...baseRepoObject,
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
        if (!(err instanceof Error) || typeof err !== 'string') {
          throw err;
        }
        this.error(err);
      }
    }
  }

  private exec(cmd: string, silent = false): void {
    this.log(bold(cmd));
    exec(cmd, { silent });
  }
}
