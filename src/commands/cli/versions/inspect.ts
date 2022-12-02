/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-await-in-loop */

import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs/promises';
import * as fg from 'fast-glob';
import { exec } from 'shelljs';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { green, red, cyan, yellow, bold } from 'chalk';
import { ensure } from '@salesforce/ts-types';
import { parseJson } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { PackageJson } from '../../../package';
import { CLI } from '../../../types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'cli.versions.inspect', [
  'description',
  'examples',
  'deps',
  'salesforce',
  'channels',
  'locations',
  'cli',
]);

const LEGACY_PATH = 'https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/channels/stable';
const LEGACY_TOP_LEVEL_PATH = 'https://developer.salesforce.com/media/salesforce-cli';
const SALESFORCE_DEP_GLOBS = ['@salesforce/**/*', 'salesforce-alm', 'salesforcedx'];

export type Info = {
  origin: string;
  version: string;
  channel: Channel;
  location: Location;
  dependencies?: Dependency[];
};

export type Dependency = {
  name: string;
  version: string;
};

export enum Channel {
  LEGACY = 'legacy',
  STABLE = 'stable',
  STABLE_RC = 'stable-rc',
  LATEST = 'latest',
  LATEST_RC = 'latest-rc',
}

export enum Location {
  ARCHIVE = 'archive',
  NPM = 'npm',
}

type ArchiveChannel = Extract<Channel, Channel.STABLE | Channel.STABLE_RC | Channel.LEGACY>;
type Archives = Record<ArchiveChannel, string[]>;
type ChannelMapping = Record<Location, Record<Channel, Channel>>;

const ARCHIVES: Archives = {
  [Channel.STABLE]: [
    '%s/%s-darwin-x64.tar.gz',
    '%s/%s-darwin-x64.tar.xz',
    '%s/%s-linux-arm.tar.gz',
    '%s/%s-linux-arm.tar.xz',
    '%s/%s-linux-x64.tar.gz',
    '%s/%s-linux-x64.tar.xz',
    '%s/%s-win32-x64.tar.gz',
    '%s/%s-win32-x64.tar.xz',
    '%s/%s-win32-x86.tar.gz',
    '%s/%s-win32-x86.tar.xz',
  ],
  [Channel.STABLE_RC]: [
    '%s/%s-darwin-x64.tar.gz',
    '%s/%s-darwin-x64.tar.xz',
    '%s/%s-linux-arm.tar.gz',
    '%s/%s-linux-arm.tar.xz',
    '%s/%s-linux-x64.tar.gz',
    '%s/%s-linux-x64.tar.xz',
    '%s/%s-win32-x64.tar.gz',
    '%s/%s-win32-x64.tar.xz',
    '%s/%s-win32-x86.tar.gz',
    '%s/%s-win32-x86.tar.xz',
  ],
  [Channel.LEGACY]: [
    `${LEGACY_PATH}/%s-darwin-x64.tar.gz`, // sfdx-cli
    `${LEGACY_PATH}/%s-darwin-x64.tar.xz`, // sfdx-cli
    `${LEGACY_PATH}/%s-linux-arm.tar.gz`, // sfdx-cli
    `${LEGACY_PATH}/%s-linux-arm.tar.xz`, // sfdx-cli
    `${LEGACY_PATH}/%s-linux-x64.tar.gz`, // sfdx-cli
    `${LEGACY_PATH}/%s-linux-x64.tar.xz`, // sfdx-cli
    `${LEGACY_PATH}/%s-windows-x64.tar.gz`, // sfdx-cli
    `${LEGACY_PATH}/%s-windows-x64.tar.xz`, // sfdx-cli
    `${LEGACY_PATH}/%s-windows-x86.tar.gz`, // sfdx-cli
    `${LEGACY_PATH}/%s-windows-x86.tar.xz`, // sfdx-cli
    `${LEGACY_TOP_LEVEL_PATH}/%s-linux-amd64.tar.gz`,
    `${LEGACY_TOP_LEVEL_PATH}/%s-linux-amd64.tar.xz`,
  ],
};

const CHANNEL_MAPPING: ChannelMapping = {
  [Location.NPM]: {
    [Channel.STABLE_RC]: Channel.LATEST_RC,
    [Channel.STABLE]: Channel.LATEST,
    [Channel.LATEST_RC]: Channel.LATEST_RC,
    [Channel.LATEST]: Channel.LATEST,
    [Channel.LEGACY]: Channel.LEGACY,
  },
  [Location.ARCHIVE]: {
    [Channel.LATEST_RC]: Channel.STABLE_RC,
    [Channel.LATEST]: Channel.STABLE,
    [Channel.STABLE_RC]: Channel.STABLE_RC,
    [Channel.STABLE]: Channel.STABLE,
    [Channel.LEGACY]: Channel.LEGACY,
  },
};

const CLI_META = {
  [CLI.SFDX]: {
    npm: 'https://www.npmjs.com/package/sfdx-cli',
    repoName: 'sfdx-cli',
    packageName: 'sfdx-cli',
  },
  [CLI.SF]: {
    npm: 'https://www.npmjs.com/package/@salesforce/cli',
    repoName: 'cli',
    packageName: '@salesforce/cli',
  },
};

export default class Inspect extends SfCommand<Info[]> {
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flags = {
    dependencies: Flags.string({
      summary: messages.getMessage('deps'),
      char: 'd',
      multiple: true,
    }),
    salesforce: Flags.boolean({
      summary: messages.getMessage('salesforce'),
      char: 's',
      default: false,
    }),
    channels: Flags.string({
      summary: messages.getMessage('channels'),
      char: 'c',
      options: Object.values(Channel),
      required: true,
      multiple: true,
    }),
    locations: Flags.string({
      summary: messages.getMessage('locations'),
      char: 'l',
      options: Object.values(Location),
      required: true,
      multiple: true,
    }),
    cli: Flags.enum({
      summary: messages.getMessage('cli'),
      options: Object.values(CLI),
      default: CLI.SFDX,
      required: true,
    }),
  };

  public workingDir = path.join(os.tmpdir(), 'cli_inspection');
  public archives: Archives;

  private flags: Interfaces.InferredFlags<typeof Inspect.flags>;

  public async run(): Promise<Info[]> {
    const { flags } = await this.parse(Inspect);
    this.flags = flags;

    const locations = this.flags.locations as Location[];
    const channels = this.flags.channels as Channel[];

    if (this.flags.cli === CLI.SF && channels.includes(Channel.LEGACY)) {
      throw new SfError('the sf CLI does not have a legacy channel');
    }

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
    const cli = ensure<CLI>(this.flags.cli as CLI);
    const stablePath = `https://developer.salesforce.com/media/salesforce-cli/${cli}/channels/stable`;
    const stableRcPath = `https://developer.salesforce.com/media/salesforce-cli/${cli}/channels/stable-rc`;
    this.archives = {} as Archives;
    for (const [channel, paths] of Object.entries(ARCHIVES)) {
      if (channel === Channel.LEGACY && cli === CLI.SFDX) {
        this.archives[channel] = paths.map((p) => {
          if (p.includes('amd64')) {
            return util.format(p, this.flags.cli);
          } else {
            return util.format(p, CLI_META[this.flags.cli as CLI].packageName);
          }
        });
      } else if (channel === Channel.STABLE) {
        this.archives[channel] = paths.map((p) => util.format(p, stablePath, this.flags.cli));
      } else if (channel === Channel.STABLE_RC) {
        this.archives[channel] = paths.map((p) => util.format(p, stableRcPath, this.flags.cli));
      }
    }
  }

  private async inspectArchives(channels: Channel[]): Promise<Info[]> {
    const tarDir = await mkdir(this.workingDir, 'tar');

    const pathsByChannel = Object.fromEntries(
      channels
        .map((c) => CHANNEL_MAPPING[Location.ARCHIVE][c])
        .map((c) => [c, this.archives[CHANNEL_MAPPING[Location.ARCHIVE][c]]])
    );

    const results: Info[] = [];
    for (const channel of Object.keys(pathsByChannel) as Channel[]) {
      this.log(`---- ${Location.ARCHIVE} ${channel} ----`);
      for (const archivePath of pathsByChannel[channel] as string[]) {
        this.spinner.start(`Downloading: ${cyan(archivePath)}`);
        const curlResult = exec(`curl ${archivePath} -Os`, { cwd: tarDir });
        this.spinner.stop();
        if (curlResult.code !== 0) {
          this.log(red('Download failed. That is a big deal. Investigate immediately.'));
          continue;
        }
        const filename = path.basename(archivePath);
        const unpackedDir = await mkdir(this.workingDir, 'unpacked', filename);
        this.spinner.start(`Unpacking: ${cyan(unpackedDir)}`);
        const tarResult = exec(`tar -xf ${filename} -C ${unpackedDir} --strip-components 1`, { cwd: tarDir });
        this.spinner.stop();
        if (tarResult.code !== 0) {
          this.log(red('Failed to unpack. Skipping...'));
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
    const cliMeta = CLI_META[this.flags.cli as CLI];
    const npmDir = await mkdir(this.workingDir, 'npm');
    const results: Info[] = [];
    const tags = channels.map((c) => CHANNEL_MAPPING[Location.NPM][c]).filter((c) => c !== Channel.LEGACY);
    for (const tag of tags) {
      this.log(`---- ${Location.NPM} ${tag} ----`);
      const installDir = await mkdir(npmDir, tag);
      const name = `${cliMeta.packageName}@${tag}`;
      this.spinner.start(`Installing: ${cyan(name)}`);
      exec(`npm install ${name}`, { cwd: installDir, silent: true });
      this.spinner.stop();
      const pkgJson = await readPackageJson(path.join(installDir, 'node_modules', cliMeta.repoName));
      results.push({
        dependencies: await this.getDependencies(installDir),
        origin: `${cliMeta.npm}/v/${pkgJson.version}`,
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
    let allMatch: boolean;
    let npmAndArchivesMatch: boolean;
    this.log();
    results.forEach((result) => {
      this.log(bold(`${result.origin}: ${green(result.version)}`));
      result.dependencies.forEach((dep) => {
        this.log(`  ${dep.name}: ${dep.version}`);
      });
    });
    this.log();

    if (locations.includes(Location.ARCHIVE)) {
      const archivesMatch =
        new Set(results.filter((r) => r.location === Location.ARCHIVE).map((r) => r.version)).size === 1;
      this.log(`${'All archives match?'} ${archivesMatch ? green(archivesMatch) : yellow(archivesMatch)}`);

      channels.forEach((channel) => {
        allMatch = new Set(results.filter((r) => r.channel === channel).map((r) => r.version)).size === 1;
        this.log(
          `${`All ${Location.ARCHIVE}@${channel} versions match?`} ${allMatch ? green(allMatch) : red(allMatch)}`
        );
      });
    }

    if (locations.includes(Location.NPM) && locations.includes(Location.ARCHIVE)) {
      channels
        .filter((c) => c !== Channel.LEGACY)
        .forEach((channel) => {
          const npmChannel = CHANNEL_MAPPING[Location.NPM][channel];
          const archiveChannel = CHANNEL_MAPPING[Location.ARCHIVE][channel];

          npmAndArchivesMatch =
            new Set(
              results.filter((r) => r.channel === npmChannel || r.channel === archiveChannel).map((r) => r.version)
            ).size === 1;

          const match = npmAndArchivesMatch ? green(true) : red(false);
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
