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

import fs from 'node:fs';
import { exec as execSync } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import semver from 'semver';
import got from 'got';
import { diff, Operation } from 'just-diff';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { env, parseJson } from '@salesforce/kit';
import { Octokit } from '@octokit/core';
import { paginateRest, PaginateInterface } from '@octokit/plugin-paginate-rest';
import { ensureString, get, isNumber, JsonMap } from '@salesforce/ts-types';
import { Interfaces } from '@oclif/core';
import { PackageJson } from '../../../package.js';

const MyOctokit = Octokit.plugin(paginateRest);
const exec = promisify(execSync);

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.artifacts.compare');

async function getOwnerAndRepo(plugin: string): Promise<{ owner: string; repo: string }> {
  const result = await exec(`npm view ${plugin} repository.url --json`);
  try {
    const [owner, repo] = (
      result.stdout.includes('"')
        ? // it returned json (a string in quotes ex: "git+https://github.com/salesforcecli/plugin-org.git")
          (JSON.parse(result.stdout.trim()) as string)
        : // it returned non-json (just the string) https://github.com/npm/cli/issues/7537
          result.stdout
    )
      .replace('git+https://github.com/', '')
      .replace('.git', '')
      .trim()
      .split('/');
    return { owner, repo };
  } catch (e) {
    throw SfError.create({ message: `Error getting owner and repo for ${plugin}`, cause: e, data: result });
  }
}

async function getNpmVersions(plugin: string): Promise<string[]> {
  const versions = await exec(`npm view ${plugin} versions --json`);
  return semver.rsort(JSON.parse(versions.stdout) as string[]);
}

function verifyCurrentIsNewer(current: string | undefined, previous: string | undefined): void {
  if (!current || !previous) return;
  if (semver.lt(current, previous)) {
    throw new Error(messages.getMessage('error.InvalidVersions', [current, previous]));
  }
}

export type ArtifactsCompareResult = {
  [plugin: string]: {
    current: {
      version: string | null;
      snapshot: CommandSnapshot[];
      schemas: Record<string, JsonMap>;
    };
    previous: {
      version: string | null;
      snapshot: CommandSnapshot[];
      schemas: Record<string, JsonMap>;
    };
    snapshotChanges: SnapshotChanges;
    schemaChanges: SchemaChanges;
  };
};

type CommandSnapshot = {
  command: string;
  plugin: string;
  flags: string[];
  alias: string[];
  args?: string[];
};

type SnapshotChanges = {
  commandAdditions: string[];
  commandRemovals: string[];
  commands: Array<{
    command: string;
    aliasAdditions: string[];
    aliasRemovals: string[];
    flagAdditions: string[];
    flagRemovals: string[];
    hasChanges: boolean;
    hasBreakingChanges: boolean;
  }>;
  hasChanges: boolean;
  hasBreakingChanges: boolean;
};

type SchemaChanges = Array<{ op: Operation; path: Array<string | number>; value: unknown }>;

export class SnapshotComparator {
  public constructor(public current: CommandSnapshot[], public previous: CommandSnapshot[]) {}

  public getChanges(): SnapshotChanges {
    const commandAdditions = this.getCommandAdditions();
    const commandRemovals = this.getCommandRemovals();

    const commands = this.current
      .map((cmd) => cmd.command)
      .map((cmd) => {
        const aliasAdditions = this.getAliasAdditions(cmd);
        const aliasRemovals = this.getAliasRemovals(cmd);
        const flagAdditions = this.getFlagAdditions(cmd);
        const flagRemovals = this.getFlagRemovals(cmd);
        return {
          command: cmd,
          aliasAdditions,
          aliasRemovals,
          flagAdditions,
          flagRemovals,
          hasChanges: Boolean(
            aliasAdditions.length || aliasRemovals.length || flagAdditions.length || flagRemovals.length
          ),
          hasBreakingChanges: Boolean(aliasRemovals.length || flagRemovals.length),
        };
      });
    const hasRemovals = commands.find((cmd) => cmd.aliasRemovals.length > 0 || cmd.flagRemovals.length > 0);
    const hasAdditions = commands.find((cmd) => cmd.aliasAdditions.length > 0 || cmd.flagAdditions.length > 0);
    const hasChanges = Boolean(commandAdditions.length ?? commandRemovals.length ?? hasRemovals ?? hasAdditions);
    const hasBreakingChanges = Boolean(commandRemovals.length || hasRemovals);
    return {
      commandAdditions: this.getCommandAdditions(),
      commandRemovals: this.getCommandRemovals(),
      commands,
      hasChanges,
      hasBreakingChanges,
    };
  }

  public getCommandAdditions(): string[] {
    return this.current
      .filter((cmd) => !this.previous.find((snapshot) => snapshot.command === cmd.command))
      .map((cmd) => cmd.command);
  }

  public getCommandRemovals(): string[] {
    return this.previous
      .filter((cmd) => !this.current.find((snapshot) => snapshot.command === cmd.command))
      .map((cmd) => cmd.command);
  }

  public getFlagAdditions(cmd: string): string[] {
    const current = this.current.find((snapshot) => snapshot.command === cmd);
    const previous = this.previous.find((snapshot) => snapshot.command === cmd);
    if (!current || !previous) {
      return [];
    }
    return current.flags.filter((flag) => !previous.flags.includes(flag));
  }

  public getFlagRemovals(cmd: string): string[] {
    const current = this.current.find((snapshot) => snapshot.command === cmd);
    const previous = this.previous.find((snapshot) => snapshot.command === cmd);
    if (!current || !previous) {
      return [];
    }
    return previous.flags.filter((flag) => !current.flags.includes(flag));
  }

  public getAliasAdditions(cmd: string): string[] {
    const current = this.current.find((snapshot) => snapshot.command === cmd);
    const previous = this.previous.find((snapshot) => snapshot.command === cmd);
    if (!current || !previous) {
      return [];
    }
    return current.alias.filter((alias) => !previous.alias.includes(alias));
  }

  public getAliasRemovals(cmd: string): string[] {
    const current = this.current.find((snapshot) => snapshot.command === cmd);
    const previous = this.previous.find((snapshot) => snapshot.command === cmd);
    if (!current || !previous) {
      return [];
    }
    return previous.alias.filter((alias) => !current.alias.includes(alias));
  }
}

export class SchemaComparator {
  public constructor(private current: Record<string, JsonMap>, private previous: Record<string, JsonMap>) {}

  public static makeReadable(
    current: Record<string, JsonMap>,
    previous: Record<string, JsonMap>,
    changes: SchemaChanges
  ): Record<string, string[]> {
    const humanReadableChanges: Record<string, string[]> = {};
    for (const change of changes) {
      const lastPathElement = change.path[change.path.length - 1];
      if (SchemaComparator.isMeaningless(lastPathElement)) continue;

      const objPath = change.path.join('.');
      const existing = get(previous, objPath);
      const latest = get(current, objPath);
      const [commandId] = objPath.split('.definitions');
      const readablePath = objPath.replace(`${commandId}.`, '');

      if (!humanReadableChanges[commandId]) {
        humanReadableChanges[commandId] = [];
      }

      const lastElementIsNum = isNumber(lastPathElement);
      const basePath = lastElementIsNum ? readablePath.replace(`.${lastPathElement}`, '') : readablePath;

      switch (change.op) {
        case 'replace':
          humanReadableChanges[commandId].push(
            `❌ ${chalk.underline(readablePath)} was ${chalk.red.bold('changed')} from ${chalk.cyan(
              existing
            )} to ${chalk.cyan(latest)}`
          );
          break;
        case 'add':
          humanReadableChanges[commandId].push(
            lastElementIsNum
              ? `- Array item at ${chalk.underline(basePath)} was ${chalk.cyan('added')} to current schema`
              : `- ${chalk.underline(readablePath)} was ${chalk.cyan('added')} to current schema`
          );
          break;
        case 'remove':
          humanReadableChanges[commandId].push(
            lastElementIsNum
              ? `❌ Array item at ${chalk.underline(basePath)} was ${chalk.red.bold('not found')} in current schema`
              : `❌ ${chalk.underline(readablePath)} was ${chalk.red.bold('not found')} in current schema`
          );
          break;
        default:
          break;
      }
    }

    return humanReadableChanges;
  }

  public static hasBreakingChange(changes: SchemaChanges): boolean {
    return changes.some((change) => change.op === 'remove' || change.op === 'replace');
  }

  private static isMeaningless(n: string | number): boolean {
    const meaninglessKeys: Array<string | number> = ['$comment', '__computed'];
    return meaninglessKeys.includes(n);
  }

  public getChanges(): SchemaChanges {
    return diff(this.previous, this.current);
  }
}

export default class ArtifactsTest extends SfCommand<ArtifactsCompareResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    plugin: Flags.string({
      char: 'p',
      multiple: true,
      summary: messages.getMessage('flags.plugin.summary'),
    }),
    previous: Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.previous.summary'),
    }),
    current: Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.current.summary'),
    }),
  };

  private octokit!: Octokit & { paginate: PaginateInterface };
  private currentPlugins!: Record<string, string>;
  private previousPlugins!: Record<string, string>;
  private flags!: Interfaces.InferredFlags<typeof ArtifactsTest.flags>;
  private packageJson!: PackageJson;
  private versions!: string[];
  private current!: string;
  private previous!: string;

  public async run(): Promise<ArtifactsCompareResult> {
    const { flags } = await this.parse(ArtifactsTest);
    this.flags = flags;
    const auth = ensureString(
      env.getString('GH_TOKEN') ?? env.getString('GITHUB_TOKEN'),
      'The GH_TOKEN env var is required.'
    );
    this.octokit = new MyOctokit({ auth });
    const fileData = await fs.promises.readFile('package.json', 'utf8');
    this.packageJson = parseJson(fileData) as PackageJson;

    if (!['@salesforce/cli', 'sfdx-cli'].includes(this.packageJson.name)) {
      throw messages.createError('error.InvalidRepo');
    }

    this.versions = await getNpmVersions(this.packageJson.name);

    this.resolveVersions();
    verifyCurrentIsNewer(this.current, this.previous);

    this.currentPlugins = await this.getCurrentPlugins();
    this.previousPlugins = await this.getPluginsForVersion(this.previous);

    const promises = Object.keys(this.currentPlugins).map(async (plugin) => {
      const { owner, repo } = await getOwnerAndRepo(plugin);

      const { current, previous } = await this.getVersions(plugin, owner, repo);
      const currentSnapshot = await this.getSnapshot(owner, repo, current);
      const previousSnapshot = await this.getSnapshot(owner, repo, previous);

      const currentSchemas = await this.getSchemas(owner, repo, current);
      const previousSchemas = await this.getSchemas(owner, repo, previous);
      const schemaChanges = new SchemaComparator(currentSchemas, previousSchemas).getChanges();

      return {
        [plugin]: {
          current: {
            version: current,
            snapshot: currentSnapshot,
            schemas: currentSchemas,
          },
          previous: {
            version: previous,
            snapshot: previousSnapshot,
            schemas: previousSchemas,
          },
          snapshotChanges: new SnapshotComparator(currentSnapshot, previousSnapshot).getChanges(),
          schemaChanges,
        },
      };
    });

    const results = (await Promise.all(promises)).reduce((acc, result) => ({ ...acc, ...result }), {});

    const summary = this.showResults(results);

    this.styledHeader('Summary');
    for (const [plugin, logs] of Object.entries(summary)) {
      if (logs.length === 0)
        this.log('✅', plugin, chalk.dim(`(${this.previousPlugins[plugin]} -> ${this.currentPlugins[plugin]})`));
      else {
        this.log();
        this.log('❌', plugin, chalk.dim(`(${this.previousPlugins[plugin]} -> ${this.currentPlugins[plugin]})`));
        for (const log of logs) this.log('  -', log);
        this.log();
      }
    }
    this.log();
    const removedPlugins = this.showRemovedPlugins();
    this.log();
    this.showAddedPlugins();
    this.log();

    const hasBreakingSnapshotChanges = Object.values(results).some(
      (result) => result.snapshotChanges.hasBreakingChanges
    );
    const hasBreakingSchemaChanges = Object.values(results).some((result) =>
      SchemaComparator.hasBreakingChange(result.schemaChanges)
    );
    if (hasBreakingSnapshotChanges || hasBreakingSchemaChanges || removedPlugins.length > 0) {
      throw messages.createError('error.BreakingChanges');
    }

    return results;
  }

  private showResults(results: ArtifactsCompareResult): Record<string, Array<string | string[]>> {
    const summary: Record<string, string[]> = {};
    for (const [plugin, result] of Object.entries(results)) {
      summary[plugin] = [];
      this.styledHeader(plugin);
      this.log('Current:', result.current.version);
      this.log('Previous:', result.previous.version);
      this.log();
      this.log(chalk.underline.cyan('Snapshot Changes'));
      if (result.snapshotChanges.commandAdditions.length) {
        this.log(chalk.dim('New Commands:'), result.snapshotChanges.commandAdditions);
      }

      if (result.snapshotChanges.commandRemovals.length) {
        summary[plugin].push(`Removed commands: ${result.snapshotChanges.commandRemovals.join(', ')}`);
        this.log(chalk.red('❌ Removed Commands:'), result.snapshotChanges.commandRemovals);
      }

      for (const cmd of result.snapshotChanges.commands) {
        this.log(cmd.command, !cmd.hasChanges ? chalk.dim('No Changes') : '');
        if (cmd.flagAdditions.length) this.log(chalk.dim('  Flag Additions:'), cmd.flagAdditions);
        if (cmd.flagRemovals.length) {
          summary[plugin].push(`${cmd.command} flag removals: ${cmd.flagRemovals.join(', ')}`);
          this.log(chalk.red('  ❌ Flag Removals:'), cmd.flagRemovals);
        }
        if (cmd.aliasAdditions.length) this.log(chalk.dim('  Alias Additions:'), cmd.aliasAdditions);
        if (cmd.aliasRemovals.length) {
          summary[plugin].push(`${cmd.command} alias removals: ${cmd.aliasRemovals.join(', ')}`);
          this.log(chalk.red('  ❌ Alias Removals:'), cmd.aliasRemovals);
        }
      }
      this.log();
      this.log(chalk.underline.cyan('Schema Changes'));
      const humanReadableChanges = SchemaComparator.makeReadable(
        result.current.schemas,
        result.previous.schemas,
        result.schemaChanges
      );
      if (Object.keys(humanReadableChanges).length === 0) {
        this.log(chalk.dim('No changes have been detected.'));
      }

      for (const [commandId, readableChanges] of Object.entries(humanReadableChanges)) {
        this.log();
        this.log(commandId);
        for (const change of readableChanges) {
          if (change.startsWith('❌')) summary[plugin].push(change.replace('❌', ''));
          this.log(`  ${change}`);
        }
      }
      this.log();
    }

    return summary;
  }

  private showRemovedPlugins(): string[] {
    const removedPlugins = Object.keys(this.previousPlugins).filter((p) => !this.currentPlugins[p]);
    if (removedPlugins.length > 0) {
      this.styledHeader(chalk.red('Removed Plugins'));
      for (const plugin of removedPlugins) {
        this.log(plugin);
      }
    }
    return removedPlugins;
  }

  private showAddedPlugins(): string[] {
    const addedPlugins = Object.keys(this.currentPlugins).filter((p) => !this.previousPlugins[p]);
    if (addedPlugins.length > 0) {
      this.styledHeader(chalk.green('Added Plugins'));
      for (const plugin of addedPlugins) {
        this.log(plugin);
      }
    }
    return addedPlugins;
  }

  private resolveVersions(): void {
    this.current = this.flags.current ?? this.packageJson.version;
    this.previous = ensureString(
      this.flags.previous ?? this.versions.find((version) => semver.lt(version, this.current)),
      'previous version not found'
    );
    this.log('Current Version:', this.current);
    this.log('Previous Version:', this.previous);
    if (this.flags.current && !this.versions.includes(this.flags.current)) {
      throw messages.createError('error.VersionNotFound', [this.flags.current]);
    }
    if (this.flags.previous && !this.versions.includes(this.flags.previous)) {
      throw messages.createError('error.VersionNotFound', [this.flags.previous]);
    }
  }

  private async getCurrentPlugins(): Promise<Record<string, string>> {
    return this.flags.current ? this.getPluginsForVersion(this.current) : this.filterPlugins(this.packageJson);
  }

  private async getPluginsForVersion(version: string): Promise<Record<string, string>> {
    if (!this.packageJson.repository) {
      throw new SfError('the package json does not have a repository field');
    }
    const [owner, repo] = this.packageJson.repository.split('/');
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: 'package.json',
      accept: 'application/vnd.github.json',
      ref: version,
    });

    // @ts-expect-error octokit doesn't have a type for this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const pJson = JSON.parse(Buffer.from(response.data.content ?? '', 'base64').toString()) as PackageJson;
    return this.filterPlugins(pJson);
  }

  private filterPlugins(packageJson: PackageJson): Record<string, string> {
    const pluginNames = [...(packageJson.oclif?.plugins ?? []), ...Object.keys(packageJson.oclif?.jitPlugins ?? {})];
    const filtered = (
      this.flags.plugin ? pluginNames.filter((plugin) => this.flags.plugin?.includes(plugin)) : pluginNames
    ).filter((plugin) => !plugin.startsWith('@oclif'));

    return filtered.reduce(
      (acc, plugin) => ({
        ...acc,
        [plugin]: packageJson.dependencies[plugin] ?? packageJson.oclif?.jitPlugins?.[plugin],
      }),
      {}
    );
  }

  private async getVersions(
    plugin: string,
    owner: string,
    repo: string
  ): Promise<{ current: string | null; previous: string | null }> {
    const tags = await this.getTags(owner, repo);
    const current = this.currentPlugins[plugin]
      ? tags.includes(this.currentPlugins[plugin])
        ? this.currentPlugins[plugin]
        : `v${this.currentPlugins[plugin]}`
      : null;

    const previous = this.previousPlugins[plugin]
      ? tags.includes(this.previousPlugins[plugin])
        ? this.previousPlugins[plugin]
        : `v${this.previousPlugins[plugin]}`
      : null;

    if (current?.includes('^') ?? current?.includes('~')) {
      throw messages.createError('error.VersionNotPinned', [plugin]);
    }

    return { current, previous };
  }

  private async getSchemas(owner: string, repo: string, ref: string | null): Promise<Record<string, JsonMap>> {
    if (!ref) return {};
    try {
      const schemas = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: 'schemas',
        accept: 'application/vnd.github.json',
        ref,
      });

      const schemaFiles = (schemas.data as Array<{ name: string; download_url: string; type: string }>).filter(
        (f) => f.type === 'file'
      );
      const hasHookFiles = (schemas.data as Array<{ name: string; download_url: string; type: string }>).find(
        (f) => f.name === 'hooks' && f.type === 'dir'
      );

      if (hasHookFiles) {
        const hooks = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: 'schemas/hooks',
          accept: 'application/vnd.github.json',
          ref,
        });
        schemaFiles.push(
          ...(hooks.data as Array<{ name: string; download_url: string; type: string }>).filter(
            (f) => f.type === 'file'
          )
        );
      }

      const files: Record<string, string> = schemaFiles.reduce(
        (acc, file) => ({ ...acc, [file.name]: file.download_url }),
        {}
      );

      const promises = Object.entries(files).map(async ([name, url]) => {
        const contents = await got.get<JsonMap>(url, { followRedirect: true, responseType: 'json' });
        return { [name.replace(/-/g, ':').replace(/__/g, '-').replace('.json', '')]: contents.body };
      });

      return (await Promise.all(promises)).reduce((acc, result) => ({ ...acc, ...result }), {});
    } catch {
      this.warn(`No schemas found for ${owner}/${repo}@${ref}`);
      return {};
    }
  }

  private async getSnapshot(owner: string, repo: string, ref: string | null): Promise<CommandSnapshot[]> {
    if (!ref) return [];
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: 'command-snapshot.json',
        accept: 'application/vnd.github.json',
        ref,
      });
      // @ts-expect-error octokit doesn't have a type for this
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return (JSON.parse(Buffer.from(response.data.content ?? '', 'base64').toString()) as CommandSnapshot[])
        .map(ensureAliases)
        .map(ensureFlags);
    } catch {
      this.warn(`No command-snapshot.json found for ${owner}/${repo}@${ref}`);
      return [];
    }
  }

  private async getTags(owner: string, repo: string): Promise<string[]> {
    const response = await this.octokit.paginate('GET /repos/{owner}/{repo}/tags', {
      owner,
      repo,
      // eslint-disable-next-line camelcase
      per_page: 100,
    });

    return response.map((tag: { name: string }) => tag.name);
  }
}

const ensureAliases = (snapshot: CommandSnapshot): CommandSnapshot =>
  snapshot.alias ? snapshot : { ...snapshot, alias: [] };

const ensureFlags = (snapshot: CommandSnapshot): CommandSnapshot =>
  snapshot.flags ? snapshot : { ...snapshot, flags: [] };
