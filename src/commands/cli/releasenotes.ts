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
import { Messages, SfError } from '@salesforce/core';
import { exec } from 'shelljs';
import * as semver from 'semver';
import { CLI } from '../../types';
import { NpmPackage, parseAliasedPackageName, parsePackageVersion } from '../../package';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'cli.releasenotes', [
  'description',
  'examples',
  'cliFlag',
  'sinceFlag',
  'markdownFlag',
]);

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

type Differences = {
  removed: Record<string, string>;
  added: Record<string, string>;
  upgraded: Record<string, string>;
  downgraded: Record<string, string>;
  unchanged: Record<string, string>;
};

function isNotEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0;
}

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

    const npmPackage = this.getNpmPackage(fullName, this.flags.since ?? 'latest');
    const latestrc = this.getNpmPackage(fullName, 'latest-rc');

    const oldPlugins = this.normalizePlugins(npmPackage);
    const newPlugins = this.normalizePlugins(latestrc);

    const differences = this.findDifferences(oldPlugins, newPlugins);

    if (isNotEmpty(differences.upgraded)) {
      this.ux.styledHeader('Upgraded Plugins');
      for (const [plugin, version] of Object.entries(differences.upgraded)) {
        this.ux.log(`• ${plugin} ${oldPlugins[plugin]} => ${version}`);
      }
    }

    if (isNotEmpty(differences.downgraded)) {
      this.ux.styledHeader('Downgraded Plugins');
      for (const [plugin, version] of Object.entries(differences.downgraded)) {
        this.ux.log(`• ${plugin} ${oldPlugins[plugin]} => ${version}`);
      }
    }

    if (isNotEmpty(differences.added)) {
      this.ux.styledHeader('Added Plugins');
      for (const [plugin, version] of Object.entries(differences.added)) {
        this.ux.log(`• ${plugin} ${version}`);
      }
    }

    if (isNotEmpty(differences.removed)) {
      this.ux.styledHeader('Removed Plugins');
      for (const [plugin, version] of Object.entries(differences.removed)) {
        this.ux.log(`• ${plugin} ${version}`);
      }
    }

    const changesByPlugin: ChangesByPlugin = {};
    for (const [plugin] of Object.entries(differences.upgraded)) {
      const pkg = this.getNpmPackage(plugin, oldPlugins[plugin]);
      const publishDate = pkg.time[pkg.version];
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

  private normalizePlugins(npmPackage: NpmPackage): Record<string, string> {
    const plugins = npmPackage.oclif?.plugins ?? [];
    const normalized = { [npmPackage.name]: npmPackage.version };
    plugins.forEach((p) => {
      const version = parsePackageVersion(npmPackage.dependencies[p]);
      if (npmPackage.dependencies[p].startsWith('npm:')) {
        const name = parseAliasedPackageName(npmPackage.dependencies[p]);
        normalized[name] = version;
      } else {
        normalized[p] = version;
      }
    });

    return normalized;
  }

  private findDifferences(oldPlugins: Record<string, string>, newPlugins: Record<string, string>): Differences {
    const removed = {};
    const added = {};
    const upgraded = {};
    const downgraded = {};
    const unchanged = {};

    for (const [name, version] of Object.entries(oldPlugins)) {
      if (!newPlugins[name]) removed[name] = version;
    }

    for (const [name, version] of Object.entries(newPlugins)) {
      if (!oldPlugins[name]) added[name] = version;
      else if (semver.gt(version, oldPlugins[name])) upgraded[name] = version;
      else if (semver.lt(version, oldPlugins[name])) downgraded[name] = version;
      else unchanged[name] = version;
    }

    return { removed, added, upgraded, downgraded, unchanged };
  }

  private async getNameOfUser(username: string): Promise<string> {
    if (this.usernames[username]) return this.usernames[username];

    const { data } = await this.octokit.request('GET /users/{username}', { username });
    const name = data.name ?? data.login ?? username;
    this.usernames[username] = name;
    return name;
  }

  private async getPullsForPlugin(plugin: string, publishDate: string): Promise<Change[]> {
    const npmPackage = this.getNpmPackage(plugin);
    const homepage = npmPackage.homepage ?? (npmPackage.name === 'salesforce-alm' ? 'salesforcecli/toolbelt' : null);
    if (!homepage) {
      throw new SfError(`No github url found for ${npmPackage.name}`, 'GitUrlNotFound');
    }
    const [owner, repo] = homepage.replace('https://github.com/', '').replace(/#(.*)/g, '').split('/');
    const pullRequests = await this.octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: 'closed',
      base: 'main',
      // eslint-disable-next-line camelcase
      per_page: 100,
    });
    const changes = (await Promise.all(
      pullRequests.data
        .filter((pr) => {
          return pr.merged_at && pr.merged_at > publishDate && !pr.user.login.includes('dependabot');
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
