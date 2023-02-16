/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { isObject } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'github.check.closed');

export type GithubCheckClosedResult = {
  issueUrl: string;
  status: string;
  workItem: string;
};

export default class GithubCheckClosed extends SfCommand<GithubCheckClosedResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    gus: Flags.requiredOrg({
      summary: messages.getMessage('flags.gus'),
    }),
    'github-token': Flags.string({
      summary: messages.getMessage('flags.github-token'),
      env: 'GITHUB_TOKEN',
      required: true,
    }),
  };

  public async run(): Promise<GithubCheckClosedResult[]> {
    const { flags } = await this.parse(GithubCheckClosed);
    const ThrottledOctokit = Octokit.plugin(throttling);
    const octokit = new ThrottledOctokit({
      auth: flags['github-token'],
      throttle: {
        onRateLimit: () => true,
        onSecondaryRateLimit: () => true,
      },
    });

    // search open issues for W- in any comments
    const issues = await octokit.request('GET /search/issues', {
      q: 'is:open is:issue repo:forcedotcom/cli W- in:comments',
    });

    // get all comments for those issues
    const commentsWithWI = (
      await Promise.all(
        issues.data.items.map((issue) =>
          octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            // eslint-disable-next-line camelcase
            issue_number: issue.number,
            owner: 'forcedotcom',
            repo: 'cli',
          })
        )
      )
    )
      // comment includes W-
      .map((issueComments) => issueComments.data.find((comment) => comment.body.includes('W-')))
      .filter(isObject)
      // extract url and WI number
      .map((comment) => ({ issueUrl: comment.issue_url, workItem: comment.body.match(/W-[0-9]{8,9}/g) }))
      .filter((item) => item.workItem?.length)
      .map((item) => ({ issueUrl: item.issueUrl, workItem: item.workItem[0] }));

    const wiToQuery = commentsWithWI.map((item) => item.workItem);
    // query all those WI in GUS, and turn into a Map
    const wiQueryResult = new Map<string, string>(
      (
        await flags.gus
          .getConnection()
          .sobject('ADM_Work__c')
          .find({ Name: { $in: wiToQuery } })
      ).map((item) => [item.Name, item.Status__c])
    );

    // join GH and GUS results
    const results = commentsWithWI
      .map(
        (item): GithubCheckClosedResult => ({
          ...item,
          status: wiQueryResult.get(item.workItem),
          issueUrl: item.issueUrl.replace('api.', '').replace('repos/', ''),
        })
      )
      .filter((item) => item.status);
    this.table(
      results,
      {
        issueUrl: { header: 'github issue' },
        workItem: { header: 'work item' },
        status: { header: 'status' },
      },
      { sort: 'status' }
    );
    return results;
  }
}
