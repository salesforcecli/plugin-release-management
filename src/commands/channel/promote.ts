/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, ensureArray, ensureNumber, ensureString } from '@salesforce/ts-types';
import { ShellString } from 'shelljs';
import { bold } from 'chalk';
import { isMonoRepo } from '../../repository';
import { Channel, CLI, S3Manifest, VersionShaContents } from '../../types';
import { AmazonS3 } from '../../amazonS3';
import { Flags, verifyDependencies } from '../../dependencies';
import { PluginCommand } from '../../pluginCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'channel.promote');
const TARGETS = ['linux-x64', 'linux-arm', 'win32-x64', 'win32-x86', 'darwin-x64'];
export default class Promote extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    dryrun: flags.boolean({
      char: 'd',
      default: false,
      description: messages.getMessage('dryrun'),
    }),
    target: flags.string({
      char: 't',
      default: Channel.STABLE,
      description: messages.getMessage('target'),
      // options: Object.values(Channel),
      required: true,
    }),
    candidate: flags.string({
      char: 'C',
      description: messages.getMessage('candidate'),
      // options: Object.values(Channel),
      exclusive: ['sha'],
    }),
    platform: flags.array({
      char: 'p',
      description: messages.getMessage('platform'),
      required: true,
      options: ['win', 'macos', 'deb'],
      multiple: true,
    }),
    cli: flags.enum({
      char: 'c',
      description: messages.getMessage('cli'),
      required: true,
      options: Object.values(CLI),
    }),
    sha: flags.string({
      char: 's',
      description: messages.getMessage('sha'),
      exclusive: ['candidate'],
      parse: (input: string): string => {
        return input.slice(0, 7);
      },
      validate: (input: string): boolean => {
        if (input.length < 7) {
          return false;
        }
        return true;
      },
    }),
    maxage: flags.number({
      char: 'm',
      description: messages.getMessage('maxage'),
      default: 300,
    }),
    indexes: flags.boolean({
      char: 'i',
      description: messages.getMessage('indexes'),
      default: true,
      allowNo: true,
    }),
    xz: flags.boolean({
      char: 'x',
      description: messages.getMessage('xz'),
      default: true,
      allowNo: true,
    }),
    targets: flags.array({
      char: 'T',
      description: messages.getMessage('targets'),
      options: TARGETS,
    }),
    version: flags.string({
      char: 'T',
      description: messages.getMessage('version'),
      exclusive: ['sha', 'candidate'],
      parse: (input: string): string => input.trim(),
      validate: (input: string): boolean => /^([0-9]+\.){2}[0-9]+$/.test(input),
    }),
  };

  public async run(): Promise<AnyJson> {
    if (await isMonoRepo()) {
      const errType = 'InvalidRepoType';
      throw new SfdxError(messages.getMessage(errType), errType);
    }
    this.validateFlags();
    const cli = this.flags.cli as CLI;
    const target = ensureString(this.flags.target);
    const maxAge = ensureNumber(this.flags.maxage);
    const indexes = this.flags.indexes ? '--indexes' : '';
    const xz = this.flags.xz ? '--xz' : '--no-xz';
    const targets = this.flags.targets ? (['--targets', ...ensureArray(this.flags.targets)] as string[]) : [];
    const { sha, version } = await this.determineShaAndVersion(cli);

    const platforms = ensureArray(this.flags.platform).map((p: string) => `--${p}`);

    if (!this.flags.dryrun) {
      const oclifPlugin = await PluginCommand.create({
        commandBin: 'oclif',
        npmName: 'oclif',
        cliRoot: this.config.root,
      });
      const results = oclifPlugin.runPluginCmd({
        command: 'promote',
        parameters: [
          '--version',
          version,
          '--sha',
          sha,
          '--channel',
          target,
          '--max-age',
          `${maxAge}`,
          ...platforms,
          ...targets,
          indexes,
          xz,
        ],
      }) as ShellString;
      this.ux.log(results.stdout);
    } else {
      if (!this.flags.json) {
        this.log(
          messages.getMessage(
            'DryRunMessage',
            [cli, version, sha, target, ensureArray(this.flags.platform).join(', ')].map((s) => bold(s))
          )
        );
      }
    }
    return {
      dryRun: !!this.flags.dryrun,
      cli,
      target,
      sha,
      version,
      platforms: ensureArray(this.flags.platform),
    };
  }

  private async determineShaAndVersion(cli: CLI): Promise<{ sha: string; version: string }> {
    if (this.flags.candidate) {
      const manifest = await this.findManifestForCandidate(cli, this.flags.candidate);
      return { sha: manifest.sha, version: manifest.version };
    } else if (this.flags.version) {
      const sha = await this.findShaForVersion(cli, ensureString(this.flags.version));
      return { sha, version: ensureString(this.flags.version) };
    } else {
      const sha = ensureString(this.flags.sha);
      const version = await this.findVersionForSha(cli, sha);
      return { sha, version };
    }
    throw new SfdxError(messages.getMessage('CouldNotDetermineShaAndVersion'));
  }

  private validateFlags(): void {
    if (!this.flags.version && !this.flags.sha && !this.flags.candidate) {
      throw new SfdxError(messages.getMessage('MissingSourceOfPromote'));
    }
    if (this.flags.candidate && this.flags.candidate === this.flags.target) {
      throw new SfdxError(messages.getMessage('CannotPromoteToSameChannel'));
    }
    const deps = verifyDependencies(
      this.flags,
      (dep) => dep.name.startsWith('AWS'),
      (args: Flags) => !args.dryrun
    );
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfdxError(messages.getMessage(errType), errType, missing);
    }
  }

  private async findManifestForCandidate(cli: CLI, channel: Channel): Promise<S3Manifest> {
    const amazonS3 = new AmazonS3({ cli, channel });
    return await amazonS3.getManifestFromChannel(channel);
  }

  private async findShaForVersion(cli: CLI, version: string): Promise<string> {
    const amazonS3 = new AmazonS3({ cli });
    const versions = await amazonS3.listCommonPrefixes('versions');
    const foundVersion = versions.find((v) => v.Prefix.endsWith(`${version}/`))?.Prefix;
    if (foundVersion) {
      this.logger.debug(`Looking for version ${version} for cli ${cli}. Found ${foundVersion}`);
      const versionShas = await amazonS3.listCommonPrefixes(foundVersion);
      this.logger.debug(`Looking for version ${version} for cli ${cli} shas. Found ${versionShas.length} entries`);
      const manifestForMostRecentSha = (
        (
          await Promise.all(
            versionShas.map(async (versionSha) => {
              const versionShaContents = (await amazonS3.listKeyContents(
                versionSha.Prefix
              )) as unknown as VersionShaContents[];
              return versionShaContents.map((content) => {
                return { ...content, ...{ LastModifiedDate: new Date(content.LastModified) } };
              });
            })
          )
        ).flat() as VersionShaContents[]
      )
        .filter((content) => content.Key.includes('manifest'))
        .sort((left, right) => right.LastModifiedDate.getMilliseconds() - left.LastModifiedDate.getMilliseconds())
        .find((content) => content);
      if (manifestForMostRecentSha) {
        const manifest = await amazonS3.getObject({
          Key: manifestForMostRecentSha.Key,
          ResponseContentType: 'application/json',
        });
        this.logger.debug(`Loaded manifest ${manifestForMostRecentSha.Key} contents: ${manifest.toString()}`);
        const json = JSON.parse(manifest.Body.toString()) as S3Manifest;
        return json.sha;
      }
    }
    const error = new SfdxError(messages.getMessage('CouldNotLocateShaForVersion', [version]));
    this.logger.debug(error);
    throw error;
  }
  private async findVersionForSha(cli: CLI, sha: string): Promise<string> {
    const amazonS3 = new AmazonS3({ cli });
    const foundVersion = (
      await Promise.all(
        (
          await amazonS3.listCommonPrefixes('versions')
        ).map(async (version) => {
          return await amazonS3.listCommonPrefixes(version.Prefix);
        })
      )
    )
      .flat()
      .find((s) => s.Prefix.replace(/\/$/, '').endsWith(sha));
    if (foundVersion) {
      // Prefix looks like this "media/salesforce-cli/sf/versions/0.0.10/1d4b10d/",
      // when reversed after split version number should occupy entry 1 of the array
      return foundVersion.Prefix.replace(/\/$/, '').split('/').reverse()[1];
    }
    const error = new SfdxError(messages.getMessage('CouldNotLocateVersionForSha', [sha]));
    this.logger.debug(error);
    throw error;
  }
}
