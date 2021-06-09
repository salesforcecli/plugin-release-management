/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call*/

import { SfdxCommand, FlagsConfig, flags } from '@salesforce/command';
import { Octokit } from '@octokit/core';
import { Env } from '@salesforce/kit';
import { diff, ReleaseType } from 'semver';
import { ensureString } from '@salesforce/ts-types';

export type BumpType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>;
interface PullRequest {
  state: string;
  title: string;
  user: {
    login: string;
  };
  // eslint-disable-next-line camelcase
  html_url: string;
  number: number;
  head: {
    sha: string;
  };
}
export default class AutoMerge extends SfdxCommand {
  public static readonly flagsConfig: FlagsConfig = {
    owner: flags.string({
      char: 'o',
      description: 'github username of the repo owner',
    }),
    repo: flags.string({
      char: 'r',
      description: 'github repo name',
    }),
    'max-version-bump': flags.enum({
      description: 'how big of version bumps to allow',
      char: 'm',
      options: ['major', 'minor', 'patch'],
      default: 'minor',
      required: true,
    }),
    dryrun: flags.boolean({
      description: 'queries github to find mergeale PRs but does not merge',
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    this.octokit = new Octokit({ auth });
    this.baseRepoObject = {
      owner: this.flags.owner as string,
      repo: this.flags.repo as string,
    };

    const eligiblePRs = (
      await this.octokit.request('GET /repos/{owner}/{repo}/pulls', this.baseRepoObject)
    ).data.filter(
      (pr) => pr.state === 'open' && pr.user.login === 'dependabot[bot]' && this.meetsVersionCriteria(pr.title)
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
        // eslint-disable-next-line camelcase
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
      // eslint-disable-next-line camelcase
      pull_number: pr.number,
    });
    // mergeable_state of 'blocked' is ok because that's just missing an approval
    if (statusResponse.data.mergeable === true && statusResponse.data.mergeable_state !== 'behind') {
      return pr;
    }
  }

  private meetsVersionCriteria(title: string): boolean {
    const versionsRegex = /[0-9]+.[0-9]+.[0-9]+/g;
    const [from, to] = title.match(versionsRegex);

    const bumpType = diff(from, to);
    const inclusionMap = {
      major: ['major', 'minor', 'patch'] as BumpType[],
      minor: ['minor', 'patch'] as BumpType[],
      patch: ['patch'] as BumpType[],
    };

    const maxVersionBump = this.flags['max-version-bump'];
    const includeBumps = inclusionMap[maxVersionBump];
    return includeBumps.includes(bumpType) as boolean;
  }
}
