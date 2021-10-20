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
import { isMonoRepo, SinglePackageRepo } from '../../repository';
import { Channel, CLI, S3Manifest } from '../../types';
import { AmazonS3 } from '../../amazonS3';
import { Flags, verifyDependencies } from '../../dependencies';
import { PluginCommand } from '../../pluginCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'channel.promote');
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
      options: Object.values(Channel),
      required: true,
    }),
    candidate: flags.string({
      char: 'c',
      description: messages.getMessage('candidate'),
      options: Object.values(Channel),
      exclusive: ['sha'],
    }),
    platform: flags.array({
      char: 'p',
      description: messages.getMessage('platform'),
      required: true,
      options: ['win', 'macos', 'deb'],
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
    }),
    maxage: flags.number({
      char: 'm',
      description: messages.getMessage('maxage'),
      default: 300,
    }),
  };
  private pkg: SinglePackageRepo;

  public async run(): Promise<AnyJson> {
    if (await isMonoRepo()) {
      const errType = 'InvalidRepoType';
      throw new SfdxError(messages.getMessage(errType), errType);
    }

    this.pkg = await SinglePackageRepo.create({ ux: this.ux });
    this.validateFlags();
    let sha: string;
    const cli = this.flags.cli as CLI;
    const target = ensureString(this.flags.target);
    const maxAge = ensureNumber(this.flags.maxage);
    let version: string;
    if (this.flags.candidate) {
      const manifest = await this.findManifestForCandidate(cli, this.flags.candidate);
      sha = manifest.sha;
      version = manifest.version;
    } else {
      sha = ensureString(this.flags.sha);
      version = this.pkg.package.npmPackage.version;
    }

    const platforms = ensureArray(this.flags.platform)
      .map((p: string) => `--${p}`)
      .join(' ');

    if (!this.flags.dryrun) {
      const oclifPlugin = new PluginCommand({ commandBin: 'oclif', npmName: 'oclif', cliRoot: this.config.root });
      const results = oclifPlugin.runPluginCmd({
        command: 'promote',
        parameters: [
          '--help',
          ' --version',
          version,
          '--sha',
          sha,
          '--channel',
          target,
          '--max-age',
          `${maxAge}`,
          platforms,
        ],
      }) as ShellString;
      this.ux.log(results.stdout);
    } else {
      this.log(
        messages.getMessage(
          'DryRunMessage',
          [cli, version, sha, target, ensureArray(this.flags.platform).join(', ')].map((s) => bold(s))
        )
      );
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

  private validateFlags(): void {
    if (!this.flags.sha && !this.flags.candidate) {
      throw new SfdxError(messages.getMessage('MissingSourceOfPromote'));
    }
    if (this.flags.candidate && this.flags.candidate === this.flags.target) {
      throw new SfdxError(messages.getMessage('CannotPromoteToSameChannel'));
    }
    const deps = verifyDependencies(
      this.flags,
      (dep) => dep.name.startsWith('AWS') || dep.name.startsWith('NPM'),
      (args: Flags) => !args.dryrun
    );
    if (deps.failures > 0) {
      const errType = 'MissingDependencies';
      const missing = deps.results.filter((d) => d.passed === false).map((d) => d.message);
      throw new SfdxError(messages.getMessage(errType), errType, missing);
    }
  }

  private async findManifestForCandidate(cli: CLI, channel: Channel): Promise<S3Manifest> {
    const amazonS3 = new AmazonS3(cli, channel, this.ux);
    return await amazonS3.getManifest();
  }
}
