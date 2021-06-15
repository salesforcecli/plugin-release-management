/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, camelcase*/
import * as os from 'os';
import { SfdxCommand, FlagsConfig, flags } from '@salesforce/command';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { meetsVersionCriteria, maxVersionBumpFlag, getOwnerAndRepo } from '../../dependabot';

const messagesFromConsolidate = Messages.loadMessages(
  '@salesforce/plugin-release-management',
  'dependabot.consolidate'
);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.automerge');

interface PullRequest {
  state: string;
  title: string;
  user: {
    login: string;
  };
  html_url: string;
  number: number;
  head: {
    sha: string;
  };
}
export default class AutoMerge extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);

  public static readonly flagsConfig: FlagsConfig = {
    owner: flags.string({
      char: 'o',
      description: messagesFromConsolidate.getMessage('owner'),
    }),
    repo: flags.string({
      char: 'r',
      description: messagesFromConsolidate.getMessage('repo'),
      dependsOn: ['owner'],
    }),
    'max-version-bump': maxVersionBumpFlag,
    dryrun: flags.boolean({
      description: messagesFromConsolidate.getMessage('dryrun'),
      char: 'd',
      default: false,
    }),
  };

  private octokit: Octokit;
  private baseRepoObject: {
    owner: string;
    repo: string;
  };

  public async run(): Promise<void> {
    const auth = ensureString(new Env().getString('GH_TOKEN'), 'GH_TOKEN is required to be set in the environment');
    const { owner, repo } = await getOwnerAndRepo(this.flags.owner, this.flags.repo);

    this.octokit = new Octokit({ auth });
    this.baseRepoObject = {
      owner,
      repo,
    };

    const eligiblePRs = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls', this.baseRepoObject)
    ).data.filter(
      (pr) =>
        pr.state === 'open' &&
        pr.user.login === 'dependabot[bot]' &&
        meetsVersionCriteria(pr.title, this.flags['max-version-bump'])
    ) as PullRequest[];

    const greenPRs = (await Promise.all(eligiblePRs.map((pr) => this.isGreen(pr)))).filter((pr) => pr !== undefined);
    const mergeablePRs = (await Promise.all(greenPRs.map((pr) => this.isMergeable(pr)))).filter(
      (pr) => pr !== undefined
    );

    this.ux.log(`green, mergeable PRs: ${mergeablePRs.map((pr) => pr.html_url).join(', ')}`);

    if (mergeablePRs.length === 0) {
      this.ux.log('No PRs can be automerged');
      return;
    }

    const prToMerge = mergeablePRs[0];
    this.ux.log(
      `will merge PR ${prToMerge.number.toString()} | ${prToMerge.title} if not dryrun [${
        this.flags.dryrun as string
      }] is not true`
    );

    if (this.flags.dryrun === false) {
      this.ux.log('starting merge');
      const mergeResult = await this.octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        ...this.baseRepoObject,
        pull_number: mergeablePRs[0].number,
      });
      this.ux.logJson(mergeResult);
    }
  }

  private async isGreen(pr: PullRequest): Promise<PullRequest | undefined> {
    const statusResponse = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
      ...this.baseRepoObject,
      ref: pr.head.sha,
    });
    if (statusResponse.data.state === 'success') {
      return pr;
    }
  }

  private async isMergeable(pr: PullRequest): Promise<PullRequest | undefined> {
    const statusResponse = await this.octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      ...this.baseRepoObject,
      pull_number: pr.number,
    });
    // mergeable_state of 'blocked' is ok because that's just missing an approval.
    // We're screening out 'behind' which might be merge conflicts.
    // Dependabot should rebase this PR eventually
    if (statusResponse.data.mergeable === true && statusResponse.data.mergeable_state !== 'behind') {
      return pr;
    }
  }
}
