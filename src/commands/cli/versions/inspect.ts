/*
 * Copyright 2026, Salesforce, Inc.
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
/* eslint-disable no-await-in-loop */

import os from 'node:os';
import path from 'node:path';
import util from 'node:util';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import shelljs from 'shelljs';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import chalk from 'chalk';
import { entriesOf } from '@salesforce/ts-types';
import { parseJson } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { PackageJson } from '../../../package.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.versions.inspect');

const SALESFORCE_DEP_GLOBS = ['@salesforce/**/*', 'salesforce-alm', 'salesforcedx'];

export type Info = {
  origin: string;
  version: string;
  channel: Channel;
  location: Location;
  dependencies: Dependency[];
};

export type InspectResult = Info[];

export type Dependency = {
  name: string;
  version: string;
};

export enum Channel {
  STABLE = 'stable',
  STABLE_RC = 'stable-rc',
  LATEST = 'latest',
  LATEST_RC = 'latest-rc',
  NIGHTLY = 'nightly',
}

export enum Location {
  ARCHIVE = 'archive',
  NPM = 'npm',
}

type ArchiveChannel = Extract<Channel, Channel.STABLE | Channel.STABLE_RC | Channel.NIGHTLY>;
type Archives = Record<ArchiveChannel, string[]>;
type ChannelMapping = Record<Location, Record<Channel, Channel>>;

const defaultArchives = [
  'sf-darwin-x64.tar.gz',
  'sf-darwin-x64.tar.xz',
  'sf-darwin-arm64.tar.gz',
  'sf-darwin-arm64.tar.xz',
  'sf-linux-arm.tar.gz',
  'sf-linux-arm.tar.xz',
  'sf-linux-x64.tar.gz',
  'sf-linux-x64.tar.xz',
  'sf-win32-x64.tar.gz',
  'sf-win32-x64.tar.xz',
  'sf-win32-x86.tar.gz',
  'sf-win32-x86.tar.xz',
  'sf-win32-arm64.tar.xz',
  'sf-win32-arm64.tar.xz',
];

const ARCHIVES: Archives = {
  [Channel.STABLE]: [...defaultArchives],
  [Channel.STABLE_RC]: [...defaultArchives],
  [Channel.NIGHTLY]: [...defaultArchives],
};

const CHANNEL_MAPPING: ChannelMapping = {
  [Location.NPM]: {
    [Channel.STABLE]: Channel.LATEST,
    [Channel.LATEST]: Channel.LATEST,
    [Channel.STABLE_RC]: Channel.LATEST_RC,
    [Channel.LATEST_RC]: Channel.LATEST_RC,
    [Channel.NIGHTLY]: Channel.NIGHTLY,
  },
  [Location.ARCHIVE]: {
    [Channel.STABLE]: Channel.STABLE,
    [Channel.LATEST]: Channel.STABLE,
    [Channel.STABLE_RC]: Channel.STABLE_RC,
    [Channel.LATEST_RC]: Channel.STABLE_RC,
    [Channel.NIGHTLY]: Channel.NIGHTLY,
  },
};

export default class Inspect extends SfCommand<InspectResult> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    dependencies: Flags.string({
      summary: messages.getMessage('flags.dependencies.summary'),
      char: 'd',
      multiple: true,
    }),
    salesforce: Flags.boolean({
      summary: messages.getMessage('flags.salesforce.summary'),
      char: 's',
      default: false,
    }),
    channels: Flags.string({
      summary: messages.getMessage('flags.channels.summary'),
      char: 'c',
      options: Object.values(Channel),
      required: true,
      multiple: true,
    }),
    locations: Flags.string({
      summary: messages.getMessage('flags.locations.summary'),
      char: 'l',
      options: Object.values(Location),
      required: true,
      multiple: true,
    }),
    'ignore-missing': Flags.boolean({
      summary: messages.getMessage('flags.ignore-missing.summary'),
      default: false,
    }),
  };

  public workingDir = path.join(os.tmpdir(), 'cli_inspection');
  public archives?: Archives;

  private flags!: Interfaces.InferredFlags<typeof Inspect.flags>;

  public async run(): Promise<InspectResult> {
    const { flags } = await this.parse(Inspect);
    this.flags = flags;

    const locations = this.flags.locations as Location[];
    const channels = this.flags.channels as Channel[];

    this.log(`Working Directory: ${this.workingDir}`);

    // ensure that we are starting with a clean directory
    try {
      await fs.rm(this.workingDir, { recursive: true, force: true });
    } catch {
      // error means that folder doesn't exist which is okay
    }
    await fs.mkdir(this.workingDir, { recursive: true });

    this.initArchives();

    const results = [
      ...(locations.includes(Location.ARCHIVE) ? await this.inspectArchives(channels) : []),
      ...(locations.includes(Location.NPM) ? await this.inspectNpm(channels) : []),
    ];

    this.logResults(results, locations, channels);

    return results;
  }

  private initArchives(): void {
    // Example formatted url: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-darwin-x64.tar.gz
    const basePath = 'https://developer.salesforce.com/media/salesforce-cli/sf/channels/%s/%s';

    this.archives = {} as Archives;
    for (const [channel, paths] of entriesOf(ARCHIVES)) {
      this.archives[channel] = paths.map((p) => util.format(basePath, channel, p));
    }
  }

  private async inspectArchives(channels: Channel[]): Promise<Info[]> {
    const tarDir = await mkdir(this.workingDir, 'tar');

    const pathsByChannel = Object.fromEntries(
      channels
        // the enums are not smart enough to know that they'll definitely be archive channels
        .map((c) => CHANNEL_MAPPING[Location.ARCHIVE][c] as ArchiveChannel)
        .map((c) => [c, this.archives?.[CHANNEL_MAPPING[Location.ARCHIVE][c] as ArchiveChannel]])
    );

    const results: Info[] = [];
    for (const channel of Object.keys(pathsByChannel) as Channel[]) {
      this.log(`---- ${Location.ARCHIVE} ${channel} ----`);
      for (const archivePath of pathsByChannel[channel] ?? []) {
        this.spinner.start(`Downloading: ${chalk.cyan(archivePath)}`);
        const curlResult = shelljs.exec(`curl ${archivePath} -Ofs`, { cwd: tarDir });
        this.spinner.stop();
        if (curlResult.code !== 0) {
          if (this.flags['ignore-missing']) {
            this.log(chalk.red(`Failed to download: ${archivePath}. Skipping because --ignore-missing flag is set.`));
            continue;
          } else {
            throw new SfError(`Failed to download: ${archivePath}. This is a big deal. Investigate immediately.`);
          }
        }
        const filename = path.basename(archivePath);
        const unpackedDir = await mkdir(this.workingDir, 'unpacked', filename);
        this.spinner.start(`Unpacking: ${chalk.cyan(unpackedDir)}`);
        const tarResult = shelljs.exec(`tar -xf ${filename} -C ${unpackedDir} --strip-components 1`, { cwd: tarDir });
        this.spinner.stop();
        if (tarResult.code !== 0) {
          this.log(chalk.red('Failed to unpack. Skipping...'));
          continue;
        }
        const pkgJson = await readPackageJson(unpackedDir);
        results.push({
          dependencies: await this.getDependencies(unpackedDir),
          origin: archivePath,
          channel,
          location: Location.ARCHIVE,
          version: pkgJson.version,
        });
      }
    }
    return results;
  }

  private async inspectNpm(channels: Channel[]): Promise<Info[]> {
    const npmDir = await mkdir(this.workingDir, 'npm');
    const results: Info[] = [];
    const tags = channels.map((c) => CHANNEL_MAPPING[Location.NPM][c]);
    for (const tag of tags) {
      this.log(`---- ${Location.NPM} ${tag} ----`);
      const installDir = await mkdir(npmDir, tag);
      const name = `@salesforce/cli@${tag}`;
      this.spinner.start(`Installing: ${chalk.cyan(name)}`);
      shelljs.exec(`npm install ${name}`, { cwd: installDir, silent: true });
      this.spinner.stop();
      const pkgJson = await readPackageJson(path.join(installDir, 'node_modules', '@salesforce/cli'));
      results.push({
        dependencies: await this.getDependencies(installDir),
        origin: `https://www.npmjs.com/package/@salesforce/cli/v/${pkgJson.version}`,
        channel: tag,
        location: Location.NPM,
        version: pkgJson.version,
      });
    }
    return results;
  }

  private async getDependencies(directory: string): Promise<Dependency[]> {
    const depGlobs: string[] = [];
    if (this.flags.dependencies) {
      const globPatterns = this.flags.dependencies.map((d) => `${directory}/node_modules/${d}`);
      depGlobs.push(...globPatterns);
    }
    if (this.flags.salesforce) {
      const globPatterns = SALESFORCE_DEP_GLOBS.map((d) => `${directory}/node_modules/${d}`);
      depGlobs.push(...globPatterns);
    }

    const dependencyPaths = await fg(depGlobs, { onlyDirectories: true, deep: 1 });
    const dependencies: Dependency[] = [];
    for (const dep of dependencyPaths) {
      const pkg = await readPackageJson(dep);
      dependencies.push({
        name: pkg.name,
        version: pkg.version,
      });
    }
    return dependencies;
  }

  private logResults(results: Info[], locations: Location[], channels: Channel[]): void {
    let allMatch: boolean | undefined;
    let npmAndArchivesMatch: boolean | undefined;
    this.log();
    results.forEach((result) => {
      this.log(chalk.bold(`${result.origin}: ${chalk.green(result.version)}`));
      result.dependencies.forEach((dep) => {
        this.log(`  ${dep.name}: ${dep.version}`);
      });
    });
    this.log();

    if (locations.includes(Location.ARCHIVE)) {
      const archivesMatch =
        new Set(results.filter((r) => r.location === Location.ARCHIVE).map((r) => r.version)).size === 1;
      this.log(`${'All archives match?'} ${archivesMatch ? chalk.green(archivesMatch) : chalk.yellow(archivesMatch)}`);

      channels.forEach((channel) => {
        allMatch = new Set(results.filter((r) => r.channel === channel).map((r) => r.version)).size === 1;
        this.log(
          `${`All ${Location.ARCHIVE}@${channel} versions match?`} ${
            allMatch ? chalk.green(allMatch) : chalk.red(allMatch)
          }`
        );
      });
    }

    if (locations.includes(Location.NPM) && locations.includes(Location.ARCHIVE)) {
      channels.forEach((channel) => {
        const npmChannel = CHANNEL_MAPPING[Location.NPM][channel];
        const archiveChannel = CHANNEL_MAPPING[Location.ARCHIVE][channel];

        npmAndArchivesMatch =
          new Set(results.filter((r) => r.channel === npmChannel || r.channel === archiveChannel).map((r) => r.version))
            .size === 1;

        const match = npmAndArchivesMatch ? chalk.green(true) : chalk.red(false);
        this.log(
          `${Location.NPM}@${npmChannel} and all ${Location.ARCHIVE}@${archiveChannel} versions match? ${match}`
        );
      });
    }
    // npmAndArchivesMatch can be undefined
    if ((npmAndArchivesMatch !== undefined && !npmAndArchivesMatch) || !allMatch) {
      throw new SfError('Version Mismatch');
    }
  }
}

const readPackageJson = async (pkgDir: string): Promise<PackageJson> => {
  const fileData = await fs.readFile(path.join(pkgDir, 'package.json'), 'utf8');
  return parseJson(fileData, path.join(pkgDir, 'package.json'), false) as PackageJson;
};

const mkdir = async (...parts: string[]): Promise<string> => {
  const dir = path.resolve(path.join(...parts));
  await fs.mkdir(dir, { recursive: true });
  return dir;
};
