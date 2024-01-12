/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { ensure, ensureString } from '@salesforce/ts-types';
import { Env } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import chalk from 'chalk';
import { Messages, SfError } from '@salesforce/core';
import shelljs from 'shelljs';
import semver from 'semver';
import { CLI } from '../../types.js';
import { NpmPackage, parsePackageVersion } from '../../package.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.releasenotes');

type Change = {
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
  removed: Map<string, string>;
  added: Map<string, string>;
  upgraded: Map<string, string>;
  downgraded: Map<string, string>;
  unchanged: Map<string, string>;
};

export default class ReleaseNotes extends SfCommand<ChangesByPlugin> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    cli: Flags.string({
      summary: messages.getMessage('flags.cli.summary'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    since: Flags.string({
      summary: messages.getMessage('flags.since.summary'),
      char: 's',
    }),
    markdown: Flags.boolean({
      summary: messages.getMessage('flags.markdown.summary'),
      char: 'm',
      default: false,
    }),
  };
  private octokit!: Octokit;
  private usernames = new Map<string, string>();

  public async run(): Promise<ChangesByPlugin> {
    const { flags } = await this.parse(ReleaseNotes);
    const auth = ensureString(new Env().getString('GH_TOKEN'), 'GH_TOKEN is required to be set in the environment');
    this.octokit = new Octokit({ auth });
    const cli = ensure<CLI>(flags.cli as CLI);
    const fullName = cli === CLI.SF ? '@salesforce/cli' : 'sfdx-cli';

    const npmPackage = getNpmPackage(fullName, flags.since ?? 'latest');
    const latestrc = getNpmPackage(fullName, 'latest-rc');

    const oldPlugins = normalizePlugins(npmPackage);
    const newPlugins = normalizePlugins(latestrc);

    const differences = findDifferences(oldPlugins, newPlugins);

    if (differences.upgraded.size) {
      this.styledHeader('Upgraded Plugins');
      for (const [plugin, version] of differences.upgraded.entries()) {
        this.log(`• ${plugin} ${oldPlugins.get(plugin)} => ${version}`);
      }
    }

    if (differences.downgraded.size) {
      this.styledHeader('Downgraded Plugins');
      for (const [plugin, version] of differences.downgraded.entries()) {
        this.log(`• ${plugin} ${oldPlugins.get(plugin)} => ${version}`);
      }
    }

    if (differences.added.size) {
      this.styledHeader('Added Plugins');
      for (const [plugin, version] of differences.added.entries()) {
        this.log(`• ${plugin} ${version}`);
      }
    }

    if (differences.removed.size) {
      this.styledHeader('Removed Plugins');
      for (const [plugin, version] of differences.removed.entries()) {
        this.log(`• ${plugin} ${version}`);
      }
    }

    const changesByPlugin: ChangesByPlugin = {};
    for (const plugin of differences.upgraded.keys()) {
      const pkg = getNpmPackage(plugin, oldPlugins.get(plugin));
      const publishDate = pkg.time?.[pkg.version];
      // eslint-disable-next-line no-await-in-loop
      const changes = await this.getPullsForPlugin(plugin, publishDate);
      if (changes.length) changesByPlugin[plugin] = changes;
    }

    if (flags.markdown) {
      this.logChangesMarkdown(changesByPlugin);
    } else {
      this.logChanges(changesByPlugin);
    }

    return changesByPlugin;
  }

  private async getNameOfUser(username: string): Promise<string> {
    const value = this.usernames.get(username);
    if (value) return value;

    const { data } = await this.octokit.request('GET /users/{username}', { username });
    const name = data.name ?? data.login ?? username;
    this.usernames.set(username, name);
    return name;
  }

  private async getPullsForPlugin(plugin: string, publishDate?: string): Promise<Change[]> {
    const npmPackage = getNpmPackage(plugin);
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
        .filter(
          (pr) => pr.merged_at && (!publishDate || pr.merged_at > publishDate) && !pr.user?.login.includes('dependabot')
        )
        .map(async (pr) => {
          const username = await this.getNameOfUser(
            ensureString(pr.user?.login, `No user.login property found for ${JSON.stringify(pr)}`)
          );
          const author = pr.user?.login === username ? username : `${username} (${pr.user?.login})`;
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
      this.styledHeader(chalk.cyan(plugin));
      for (const change of changes) {
        this.log(chalk.bold(`${change.title}`));
        for (const [key, value] of Object.entries(change)) {
          if (['title', 'plugin'].includes(key)) continue;
          if (key === 'description') {
            this.log(`${key}:\n${chalk.dim(value)}`);
          } else {
            this.log(`${key}: ${chalk.dim(value)}`);
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

const getNpmPackage = (name: string, version = 'latest'): NpmPackage => {
  const result = shelljs.exec(`npm view ${name}@${version} --json`, { silent: true });
  return JSON.parse(result.stdout) as NpmPackage;
};

const normalizePlugins = (npmPackage: NpmPackage): Map<string, string> => {
  const plugins = npmPackage.oclif?.plugins ?? [];
  const dependencies = npmPackage.dependencies ?? {};

  // return normalized;
  const pluginsTuples = plugins.map((p): [string, string] => {
    const version = parsePackageVersion(dependencies[p]);
    if (!version) {
      throw new SfError(`Could not find version for ${p}`, 'VersionNotFound');
    }
    return [p, version];
  });
  return new Map<string, string>([[npmPackage.name, npmPackage.version], ...pluginsTuples]);
};

const findDifferences = (oldPlugins: Map<string, string>, newPlugins: Map<string, string>): Differences => {
  const removed = new Map<string, string>();
  const added = new Map<string, string>();
  const upgraded = new Map<string, string>();
  const downgraded = new Map<string, string>();
  const unchanged = new Map<string, string>();

  // if it's in the old, but not in the new
  oldPlugins.forEach((version, name) => {
    if (!newPlugins.has(name)) removed.set(name, version);
  });

  newPlugins.forEach((version, name) => {
    // these are in the new, but not in the old
    if (!oldPlugins.has(name)) added.set(name, version);
    // non-null because they aren't added (new, but not old, so we know that must be in the old)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    else if (semver.gt(version, oldPlugins.get(name)!)) upgraded.set(name, version);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    else if (semver.lt(version, oldPlugins.get(name)!)) downgraded.set(name, version);
    else unchanged.set(name, version);
  });

  return { removed, added, upgraded, downgraded, unchanged };
};
