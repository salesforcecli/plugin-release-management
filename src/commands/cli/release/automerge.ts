/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, camelcase*/
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { Messages, SfError } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.release.automerge');

type BaseRepoParams = {
  owner: string;
  repo: string;
};

type PullRequestParams = BaseRepoParams & { pull_number: number };

export default class AutoMerge extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    owner: Flags.string({
      summary: messages.getMessage('owner'),
      dependsOn: ['repo'],
      aliases: ['org'],
      required: true,
    }),
    repo: Flags.string({
      summary: messages.getMessage('repo'),
      dependsOn: ['owner'],
      required: true,
    }),
    'pull-number': Flags.integer({
      summary: messages.getMessage('pull-number'),
      required: true,
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('dry-run'),
      char: 'd',
      default: false,
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('verbose'),
      default: false,
    }),
  };

  private octokit: Octokit;
  private baseRepoParams: BaseRepoParams;
  private pullRequestParams: PullRequestParams;

  public async run(): Promise<void> {
    const { flags } = await this.parse(AutoMerge);

    const { 'dry-run': dryRun, owner, repo, verbose, 'pull-number': pullNumber } = flags;

    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );

    this.octokit = new Octokit({ auth });

    this.baseRepoParams = { owner, repo };

    this.pullRequestParams = {
      ...this.baseRepoParams,
      pull_number: pullNumber,
    };

    const prData = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { ...this.pullRequestParams })
    ).data;

    // Check if PR is able to be merged.
    const stop = (reason: string): void => {
      if (verbose) this.styledJSON(prData);
      throw new SfError(`CANNOT MERGE: ${reason}`, 'AUTOMERGE_FAILURE', [
        'Run with --verbose to see PR response object',
        'Also try running this locally with the "--dry-run" flag',
      ]);
    };

    if (prData.state !== 'open') {
      stop('PR not open');
    }

    const automergeLabels = ['automerge', 'nightly-automerge'];
    if (!prData.labels.some((label) => automergeLabels.includes(label.name))) {
      stop(`Missing automerge label: [${automergeLabels.join(', ')}]`);
    }

    if (prData.user.login !== 'svc-cli-bot') {
      stop('PR must be created by "svc-cli-bot"');
    }

    if (!(await this.isGreen(prData, verbose))) {
      stop('PR checks failed');
    }

    if (!(await this.isMergeable())) {
      stop('PR is not mergable');
    }

    // Continue with merge attempt
    if (dryRun === false) {
      this.log(`Merging ${prData.number} | ${prData.title}`);

      const mergeResult = await this.octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        ...this.pullRequestParams,
      });

      this.info('Run with --verbose to see PR merge response');
      if (verbose) {
        this.styledJSON(mergeResult);
      }
    } else {
      this.logSuccess(`Dry run successful: ${prData.number} | ${prData.title}`);
    }
  }

  private async isGreen(pr, verbose): Promise<boolean> {
    const statusResponse = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
      ...this.baseRepoParams,
      ref: pr.head.sha,
    });
    // no point looking at check runs if the commit status is not green
    if (statusResponse.data.state !== 'success') {
      return false;
    }

    const checkRunResponse = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      ...this.baseRepoParams,
      ref: pr.head.sha,
    });

    if (verbose) this.styledJSON(checkRunResponse);

    if (
      checkRunResponse.data.check_runs.every(
        (cr) => cr.name === 'automerge' || (cr.status === 'completed' && ['success', 'skipped'].includes(cr.conclusion))
      )
    ) {
      return true;
    }
  }

  private async isMergeable(): Promise<boolean> {
    const statusResponse = await this.octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      ...this.pullRequestParams,
    });
    // mergeable_state of 'blocked' is ok because it is either missing an approval or the commit is not signed.
    // We're screening out 'behind' which might be merge conflicts.
    if (statusResponse.data.mergeable === true && statusResponse.data.mergeable_state !== 'behind') {
      return true;
    }
  }
}
