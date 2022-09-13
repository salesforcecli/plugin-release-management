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

export default class AutoMerge extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);

  public static readonly flagsConfig: FlagsConfig = {
    owner: flags.string({
      char: 'o',
      description: messagesFromConsolidate.getMessage('owner'),
      dependsOn: ['repo'],
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
    'skip-ci': flags.boolean({
      description: messages.getMessage('skipCi'),
      char: 's',
      default: false,
    }),
    'merge-method': flags.enum({
      description: messages.getMessage('mergeMethod'),
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
    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );
    const { owner, repo } = await getOwnerAndRepo(this.flags.owner, this.flags.repo);

    this.octokit = new Octokit({ auth });
    this.baseRepoObject = {
      owner,
      repo,
    };

    this.ux.log(`owner: ${this.baseRepoObject.owner}, scope: ${this.baseRepoObject.repo}`);
    const eligiblePRs = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls', this.baseRepoObject)
    ).data.filter((pr) => pr.state === 'open' && pr.user.login === 'dependabot[bot]') as PullRequest[];
    const greenPRs = (await Promise.all(eligiblePRs.map((pr) => this.isGreen(pr)))).filter((pr) => pr !== undefined);
    const mergeablePRs = (await Promise.all(greenPRs.map((pr) => this.isMergeable(pr)))).filter(
      (pr) => pr !== undefined
    );

    this.ux.table(mergeablePRs, {
      title: { header: 'Green, Mergeable PR' },
      html_url: { header: 'Link' },
    });
    this.ux.log('');

    if (mergeablePRs.length === 0) {
      this.ux.log('No PRs can be automerged');
      return;
    }

    const prToMerge = mergeablePRs[0];

    if (this.flags.dryrun === false) {
      this.ux.log(`merging ${prToMerge.number.toString()} | ${prToMerge.title}`);
      const opts: octokitOpts = {
        ...this.baseRepoObject,
        merge_method: this.flags['merge-method'],
        pull_number: prToMerge.number,
      };
      if (this.flags['skip-ci']) {
        opts.commit_title = `Merge pull request #${prToMerge.number} from ${prToMerge.head.ref} [skip ci]`;
      }
      const mergeResult = await this.octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', opts);
      this.ux.logJson(mergeResult);
    } else {
      this.ux.log(`dry run ${prToMerge.number.toString()} | ${prToMerge.title}`);
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
    this.ux.logJson(checkRunResponse.data);

    if (checkRunResponse.data.check_runs.every((cr) => cr.status === 'completed' && cr.conclusion === 'success')) {
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
