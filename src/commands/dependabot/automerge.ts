/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, camelcase*/
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { type AnyJson, ensureString } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { maxVersionBumpFlag, getOwnerAndRepo } from '../../dependabot.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.automerge');
const messagesFromConsolidate = Messages.loadMessages(
  '@salesforce/plugin-release-management',
  'dependabot.consolidate'
);

type PullRequest = {
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
};

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

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    owner: Flags.string({
      // eslint-disable-next-line sf-plugin/dash-o
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
      summary: messages.getMessage('flags.skip-ci.summary'),
      char: 's',
      default: false,
    }),
    'merge-method': Flags.string({
      summary: messages.getMessage('flags.merge-method.summary'),
      options: ['merge', 'squash', 'rebase'],
      default: 'merge',
    }),
  };

  // private props initialized early in run()
  private octokit!: Octokit;
  private baseRepoObject!: {
    owner: string;
    repo: string;
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AutoMerge);
    const auth = ensureString(
      new Env().getString('GH_TOKEN') ?? new Env().getString('GITHUB_TOKEN'),
      'GH_TOKEN is required to be set in the environment'
    );
    this.baseRepoObject = await getOwnerAndRepo(flags.owner, flags.repo);
    this.octokit = new Octokit({ auth });

    this.log(`owner: ${this.baseRepoObject.owner}, scope: ${this.baseRepoObject.repo}`);
    const eligiblePRs = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls', this.baseRepoObject)
    ).data.filter(
      (pr) =>
        pr.state === 'open' &&
        (pr.user?.login === 'dependabot[bot]' ||
          (pr.title.includes('refactor: devScripts update') && pr.user?.login === 'svc-cli-bot'))
    ) as PullRequest[];
    const greenPRs = (await Promise.all(eligiblePRs.map((pr) => this.isGreen(pr)))).filter(isPrNotUndefined);
    const mergeablePRs = (await Promise.all(greenPRs.map((pr) => this.isMergeable(pr)))).filter(isPrNotUndefined);

    this.table({
      data: mergeablePRs.map((pr) => ({ 'Green, Mergeable PR': pr.title, Link: pr.html_url })),
    });
    this.log('');

    const prToMerge = mergeablePRs[0];

    if (!prToMerge) {
      this.log('No PRs can be automerged');
      return;
    }

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
      this.styledJSON(mergeResult as unknown as AnyJson);
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
        (cr) => cr.status === 'completed' && cr.conclusion && ['success', 'skipped'].includes(cr.conclusion)
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

const isPrNotUndefined = (pr: PullRequest | undefined): pr is PullRequest => pr !== undefined;
