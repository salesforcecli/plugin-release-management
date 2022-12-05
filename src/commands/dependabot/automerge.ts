/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, camelcase*/
import * as os from 'os';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { maxVersionBumpFlag, getOwnerAndRepo } from '../../dependabot';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.automerge');
const messagesFromConsolidate = Messages.loadMessages(
  '@salesforce/plugin-release-management',
  'dependabot.consolidate'
);

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
    ref: string;
  };
}

type octokitOpts = {
  owner: string;
  repo: string;
  pull_number: number;
  commit_title?: string;
  merge_method?: 'merge' | 'squash' | 'rebase';
};

export default class AutoMerge extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessage('examples').split(os.EOL);

  public static readonly flags = {
    owner: Flags.string({
      char: 'o',
      summary: messagesFromConsolidate.getMessage('owner'),
      dependsOn: ['repo'],
    }),
    repo: Flags.string({
      char: 'r',
      summary: messagesFromConsolidate.getMessage('repo'),
      dependsOn: ['owner'],
    }),
    'max-version-bump': maxVersionBumpFlag,
    dryrun: Flags.boolean({
      summary: messagesFromConsolidate.getMessage('dryrun'),
      char: 'd',
      default: false,
    }),
    'skip-ci': Flags.boolean({
      summary: messages.getMessage('skipCi'),
      char: 's',
      default: false,
    }),
    'merge-method': Flags.string({
      summary: messages.getMessage('mergeMethod'),
      options: ['merge', 'squash', 'rebase'],
      default: 'merge',
    }),
  };

  private octokit: Octokit;
  private baseRepoObject: {
    owner: string;
    repo: string;
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AutoMerge);
    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );
    const { owner, repo } = await getOwnerAndRepo(flags.owner, flags.repo);

    this.octokit = new Octokit({ auth });
    this.baseRepoObject = {
      owner,
      repo,
    };

    this.log(`owner: ${this.baseRepoObject.owner}, scope: ${this.baseRepoObject.repo}`);
    const eligiblePRs = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls', this.baseRepoObject)
    ).data.filter((pr) => pr.state === 'open' && pr.user.login === 'dependabot[bot]') as PullRequest[];
    const greenPRs = (await Promise.all(eligiblePRs.map((pr) => this.isGreen(pr)))).filter((pr) => pr !== undefined);
    const mergeablePRs = (await Promise.all(greenPRs.map((pr) => this.isMergeable(pr)))).filter(
      (pr) => pr !== undefined
    );

    this.table(
      mergeablePRs.map((pr) => ({ title: pr.title, html_url: pr.html_url })),
      {
        title: { header: 'Green, Mergeable PR' },
        html_url: { header: 'Link' },
      }
    );
    this.log('');

    if (mergeablePRs.length === 0) {
      this.log('No PRs can be automerged');
      return;
    }

    const prToMerge = mergeablePRs[0];

    if (flags.dryrun === false) {
      this.log(`merging ${prToMerge.number.toString()} | ${prToMerge.title}`);
      const opts: octokitOpts = {
        ...this.baseRepoObject,
        // TODO: make oclif smarter about options on flags
        merge_method: flags['merge-method'] as 'merge' | 'squash' | 'rebase',
        pull_number: prToMerge.number,
      };
      if (flags['skip-ci']) {
        opts.commit_title = `Merge pull request #${prToMerge.number} from ${prToMerge.head.ref} [skip ci]`;
      }
      const mergeResult = await this.octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', opts);
      this.styledJSON(mergeResult);
    } else {
      this.log(`dry run ${prToMerge.number.toString()} | ${prToMerge.title}`);
    }
  }

  private async isGreen(pr: PullRequest): Promise<PullRequest | undefined> {
    const statusResponse = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
      ...this.baseRepoObject,
      ref: pr.head.sha,
    });
    // no point looking at check runs if the commit status is not green
    if (statusResponse.data.state !== 'success') {
      return undefined;
    }

    const checkRunResponse = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      ...this.baseRepoObject,
      ref: pr.head.sha,
    });
    this.styledJSON(checkRunResponse.data);

    if (
      checkRunResponse.data.check_runs.every(
        (cr) => cr.status === 'completed' && ['success', 'skipped'].includes(cr.conclusion)
      )
    ) {
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
