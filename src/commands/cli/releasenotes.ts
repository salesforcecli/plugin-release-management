/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { ensure, ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { bold, cyan, dim } from 'chalk';
import { Messages, SfdxError } from '@salesforce/core';
import { exec } from 'shelljs';
import { CLI } from '../../types';
import { NpmPackage } from '../../package';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.releasenotes');

export type Change = {
  author: string;
  description: string;
  link: string;
  mergedAt: string;
  mergedInto: string;
  plugin: string;
  title: string;
};

export type ChangesByPlugin = Record<string, Change[]>;

export default class ReleaseNotes extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    cli: flags.string({
      description: messages.getMessage('cliFlag'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    since: flags.string({
      description: messages.getMessage('sinceFlag'),
      char: 's',
    }),
    markdown: flags.boolean({
      description: messages.getMessage('markdownFlag'),
      char: 'm',
      default: false,
    }),
  };
  private octokit!: Octokit;
  private usernames: Record<string, string> = {};

  public async run(): Promise<ChangesByPlugin> {
    const auth = ensureString(new Env().getString('GH_TOKEN'), 'GH_TOKEN is required to be set in the environment');
    this.octokit = new Octokit({ auth });
    const cli = ensure<CLI>(this.flags.cli);
    const fullName = cli === CLI.SF ? '@salesforce/cli' : 'sfdx-cli';
    const npmPackage = this.getNpmPackage(fullName, this.flags.since ?? 'latest-rc');
    const publishDate = npmPackage.time[npmPackage.version];
    const plugins = this.normalizePlugins(npmPackage);
    const changesByPlugin: ChangesByPlugin = {};
    for (const plugin of plugins) {
      const changes = await this.getPullsForPlugin(plugin, publishDate);
      if (changes.length) changesByPlugin[plugin] = changes;
    }

    if (this.flags.markdown) {
      this.logChangesMarkdown(changesByPlugin);
    } else {
      this.logChanges(changesByPlugin);
    }

    return changesByPlugin;
  }

  private getNpmPackage(name: string, version = 'latest'): NpmPackage {
    const result = exec(`npm view ${name}@${version} --json`, { silent: true });
    return JSON.parse(result.stdout) as NpmPackage;
  }

  private normalizePlugins(npmPackage: NpmPackage): string[] {
    const plugins = npmPackage.oclif?.plugins ?? [];
    const normalized = plugins
      .filter((p) => !p.startsWith('@oclif'))
      .map((p) => {
        if (npmPackage.dependencies[p].startsWith('npm:')) {
          return npmPackage.dependencies[p]
            .replace('npm:', '')
            .replace(/@(\^|~)?[0-9]{1,3}(?:.[0-9]{1,3})?(?:.[0-9]{1,3})?(.*?)$/, '');
        }
        return p;
      });
    return [npmPackage.name, ...normalized];
  }

  private async getNameOfUser(username: string): Promise<string> {
    if (this.usernames[username]) return this.usernames[username];

    const { data } = await this.octokit.request('GET /users/{username}', { username });
    const name = (data.name ?? data.login ?? username) as string;
    this.usernames[username] = name;
    return name;
  }

  private async getPullsForPlugin(plugin: string, since: string): Promise<Change[]> {
    const npmPackage = this.getNpmPackage(plugin);
    const homepage = npmPackage.homepage ?? (npmPackage.name === 'salesforce-alm' ? 'salesforcecli/toolbelt' : null);
    if (!homepage) {
      throw new SfdxError(`No github url found for ${npmPackage.name}`, 'GitUrlNotFound');
    }
    const [owner, repo] = homepage.replace('https://github.com/', '').replace(/#(.*)/g, '').split('/');
    const pullRequests = await this.octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: 'closed',
      // eslint-disable-next-line camelcase
      per_page: 100,
    });
    const changes = (await Promise.all(
      pullRequests.data
        .filter((pr) => {
          return pr.merged_at && pr.merged_at > since && !pr.user.login.includes('dependabot');
        })
        .map(async (pr) => {
          const username = await this.getNameOfUser(pr.user.login);
          const author = pr.user.login === username ? username : `${username} (${pr.user.login})`;
          return {
            author,
            mergedAt: pr.merged_at,
            mergedInto: pr.base.ref,
            link: pr.html_url,
            title: pr.title,
            description: (pr.body ?? '').trim(),
            plugin,
          };
        })
    )) as Change[];
    return changes;
  }

  private logChanges(changesByPlugin: ChangesByPlugin): void {
    for (const [plugin, changes] of Object.entries(changesByPlugin)) {
      this.ux.styledHeader(cyan(plugin));
      for (const change of changes) {
        this.log(bold(`${change.title}`));
        for (const [key, value] of Object.entries(change)) {
          if (['title', 'plugin'].includes(key)) continue;
          if (key === 'description') {
            this.log(`${key}:\n${dim(value)}`);
          } else {
            this.log(`${key}: ${dim(value)}`);
          }
        }
        this.log();
      }
      this.log();
    }
  }

  private logChangesMarkdown(changesByPlugin: ChangesByPlugin): void {
    for (const [plugin, changes] of Object.entries(changesByPlugin)) {
      this.log(`## ${plugin}`);
      for (const change of changes) {
        this.log(`\n### ${change.title}`);
        for (const [key, value] of Object.entries(change)) {
          if (['title', 'plugin'].includes(key)) continue;
          if (key === 'description') {
            this.log(`- ${key}:\n\`\`\`\n${value}\n\`\`\``);
          } else {
            this.log(`- ${key}: ${value}`);
          }
        }
        this.log();
      }
      this.log();
    }
  }
}
