/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { bold } from 'chalk';
import { valid as validSemVer } from 'semver';
import { ShellString } from 'shelljs';
import { Interfaces } from '@oclif/core';

import { Logger, Messages, SfError } from '@salesforce/core';
import { AnyJson, ensureString } from '@salesforce/ts-types';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { AmazonS3 } from '../../amazonS3';
import { verifyDependencies } from '../../dependencies';
import { PluginCommand } from '../../pluginCommand';
import { CLI, Channel, S3Manifest, VersionShaContents } from '../../types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'channel.promote');
const TARGETS = ['linux-x64', 'linux-arm', 'win32-x64', 'win32-x86', 'darwin-x64'];

export default class Promote extends SfCommand<AnyJson> {
  public static readonly description = messages.getMessage('description');
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static flags = {
    dryrun: Flags.boolean({
      char: 'd',
      default: false,
      summary: messages.getMessage('dryrun'),
    }),
    'promote-to-channel': Flags.string({
      char: 't',
      default: Channel.STABLE,
      summary: messages.getMessage('target'),
      // options: Object.values(Channel),
      required: true,
      aliases: ['target'],
    }),
    'promote-from-channel': Flags.string({
      char: 'C',
      summary: messages.getMessage('candidate'),
      // options: Object.values(Channel),
      exactlyOne: ['sha', 'version', 'promote-from-channel'],
      aliases: ['candidate'],
    }),
    platform: Flags.string({
      char: 'p',
      summary: messages.getMessage('platform'),
      options: ['win', 'macos', 'deb'],
      multiple: true,
    }),
    cli: Flags.enum({
      char: 'c',
      summary: messages.getMessage('cli'),
      required: true,
      options: Object.values(CLI),
    }),
    sha: Flags.string({
      char: 's',
      summary: messages.getMessage('sha'),
      exactlyOne: ['sha', 'version', 'promote-from-channel'],
      parse: (input: string): Promise<string> => Promise.resolve(input.slice(0, 7)),
      validate: (input: string): boolean => {
        if (input.length < 7) {
          return false;
        }
        return true;
      },
    }),
    'max-age': Flags.integer({
      char: 'm',
      summary: messages.getMessage('maxage'),
      default: 300,
      aliases: ['maxage'],
    }),
    indexes: Flags.boolean({
      char: 'i',
      summary: messages.getMessage('indexes'),
      default: true,
      allowNo: true,
    }),
    xz: Flags.boolean({
      char: 'x',
      summary: messages.getMessage('xz'),
      default: true,
      allowNo: true,
    }),
    'architecture-target': Flags.string({
      char: 'T',
      summary: messages.getMessage('targets'),
      options: TARGETS,
      multiple: true,
      aliases: ['targets'],
    }),
    version: Flags.string({
      char: 'v',
      summary: messages.getMessage('version'),
      exactlyOne: ['sha', 'version', 'promote-from-channel'],
      parse: (input: string): Promise<string> => Promise.resolve(input.trim()),
      validate: (input: string): boolean => validSemVer(input) !== null,
    }),
  };

  private flags: Interfaces.InferredFlags<typeof Promote.flags>;

  public async run(): Promise<AnyJson> {
    const { flags } = await this.parse(Promote);
    this.flags = flags;
    this.validateFlags();
    // preparing parameters for call to oclif promote commands
    const cli = this.flags.cli as CLI;
    const target = ensureString(this.flags['promote-to-channel']);
    const indexes = this.flags.indexes ? '--indexes' : '';
    const xz = this.flags.xz ? '--xz' : '--no-xz';
    const targets = this.flags['architecture-target'] ?? [];
    const { sha, version } = await determineShaAndVersion(
      cli,
      this.flags['promote-from-channel'],
      this.flags.sha,
      this.flags.version
    );

    const platforms = (this.flags.platform ?? []).map((p) => `--${p}`);

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
          `${this.flags['max-age']}`,
          ...platforms,
          ...targets,
          indexes,
          xz,
        ],
      }) as ShellString;
      this.log(results.stdout);
    } else if (!this.flags.json) {
      this.log(
        messages.getMessage(
          'DryRunMessage',
          [cli, version, sha, target, this.flags.platform.join(', ')].map((s) => bold(s))
        )
      );
    }
    return {
      dryRun: !!this.flags.dryrun,
      cli,
      target,
      sha,
      version,
      platforms: this.flags.platform,
    };
  }

  /**
   * validate flag combinations
   *
   * @private
   */
  private validateFlags(): void {
    // cannot promote when channel names are the same
    if (this.flags['promote-from-channel'] && this.flags['promote-from-channel'] === this.flags['promote-to-channel']) {
      throw new SfError(messages.getMessage('CannotPromoteToSameChannel'));
    }
    // make sure necessary runtime dependencies are present
    const deps = verifyDependencies(
      this.flags,
      (dep) => dep.name.startsWith('AWS'),
      (args: typeof this.flags) => !args.dryrun
    );
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfError(messages.getMessage(errType), errType, missing);
    }
  }
}

/**
 * find a manifest file in the channel
 *
 * @param cli
 * @param channel
 * @private
 */
const findManifestForCandidate = async (cli: CLI, channel: Channel): Promise<S3Manifest> => {
  const amazonS3 = new AmazonS3({ cli, channel });
  return amazonS3.getManifestFromChannel(channel);
};

/**
 * find the version that owns the named sha
 *
 * @param cli
 * @param sha
 * @private
 */
const findVersionForSha = async (cli: CLI, sha: string): Promise<string> => {
  const amazonS3 = new AmazonS3({ cli });
  const foundVersion = (
    await Promise.all(
      (
        await amazonS3.listCommonPrefixes('versions')
      ).map(async (version) => amazonS3.listCommonPrefixes(version.Prefix))
    )
  )
    .flat()
    .find((s) => s.Prefix.replace(/\/$/, '').endsWith(sha));
  if (foundVersion) {
    // Prefix looks like this "media/salesforce-cli/sf/versions/0.0.10/1d4b10d/",
    // when reversed after split version number should occupy entry 1 of the array
    return foundVersion.Prefix.replace(/\/$/, '').split('/').reverse()[1];
  }
  const error = new SfError(messages.getMessage('CouldNotLocateVersionForSha', [sha]));
  const logger = Logger.childFromRoot('Promote.findVersionForSha');
  logger.debug(error);
  throw error;
};

/**
 * Based on which flag was provided, locate the sha and version in S3 that will be used in the promote
 *
 * when candidate channel flag present, find sha a version via the channel for candidate
 * when version flag present, find the sha from version subfolders with the most recent modified date
 * when sha flag is present, find the version that owns the subfolder named as sha value
 *
 * @param cli
 * @private
 */
const determineShaAndVersion = async (
  cli: CLI,
  candidate?: string,
  version?: string,
  sha?: string
): Promise<{ sha: string; version: string }> => {
  if (candidate) {
    const manifest = await findManifestForCandidate(cli, candidate as Channel);
    return { sha: manifest.sha, version: manifest.version };
  } else if (version) {
    const shaFromVersion = await findShaForVersion(cli, ensureString(version));
    return { sha: shaFromVersion, version: ensureString(version) };
  } else if (sha) {
    ensureString(sha);
    const versionFromSha = await findVersionForSha(cli, sha);
    return { sha, version: versionFromSha };
  }
  throw new SfError(messages.getMessage('CouldNotDetermineShaAndVersion'));
};

/**
 * find the sha that was uploaded most recently for the named version
 *
 * @param cli
 * @param version
 * @private
 */
const findShaForVersion = async (cli: CLI, version: string): Promise<string> => {
  const logger = Logger.childFromRoot('Promote.findShaForVersion');
  const amazonS3 = new AmazonS3({ cli });
  const versions = await amazonS3.listCommonPrefixes('versions');
  const foundVersion = versions.find((v) => v.Prefix.endsWith(`${version}/`))?.Prefix;
  if (foundVersion) {
    logger.debug(`Looking for version ${version} for cli ${cli}. Found ${foundVersion}`);
    const versionShas = await amazonS3.listCommonPrefixes(foundVersion);
    logger.debug(`Looking for version ${version} for cli ${cli} shas. Found ${versionShas.length} entries`);
    const manifestForMostRecentSha = (
      (
        await Promise.all(
          versionShas.map(async (versionSha) => {
            const versionShaContents = (await amazonS3.listKeyContents(
              versionSha.Prefix
            )) as unknown as VersionShaContents[];
            return versionShaContents.map((content) => ({
              ...content,
              ...{ LastModifiedDate: new Date(content.LastModified) },
            }));
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
      logger.debug(`Loaded manifest ${manifestForMostRecentSha.Key} contents: ${manifest.toString()}`);
      const json = JSON.parse(manifest.Body.toString()) as S3Manifest;
      return json.sha;
    }
  }
  const error = new SfError(messages.getMessage('CouldNotLocateShaForVersion', [version]));
  logger.debug(error);
  throw error;
};
