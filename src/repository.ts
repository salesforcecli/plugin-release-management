/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { ensureString } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { exec, ShellString } from 'shelljs';
import { Logger, SfError } from '@salesforce/core';
import { AsyncOptionalCreatable, Env, sleep } from '@salesforce/kit';
import { isString } from '@salesforce/ts-types';
import * as chalk from 'chalk';
import { Package, VersionValidation } from './package';
import { Registry } from './registry';
import { inspectCommits } from './inspectCommits';
import { SigningResponse } from './codeSigning/SimplifiedSigning';
import { api as packAndSignApi } from './codeSigning/packAndSign';

interface PrepareOpts {
  dryrun?: boolean;
  githubRelease?: boolean;
}

export type Access = 'public' | 'restricted';

interface PublishOpts {
  dryrun?: boolean;
  signatures?: SigningResponse[];
  tag?: string;
  access?: Access;
}

export interface PackageInfo {
  name: string;
  nextVersion: string;
  registryParam: string;
}

type PollFunction = () => boolean;

export type RepositoryOptions = {
  ux: UX;
  useprerelease?: string;
  shouldBePublished?: boolean;
};

abstract class Repository extends AsyncOptionalCreatable<RepositoryOptions> {
  protected options: RepositoryOptions;
  protected ux: UX;
  protected shouldBePublished: boolean;
  protected env: Env;
  protected registry: Registry;
  private stepCounter = 1;

  public constructor(options: RepositoryOptions) {
    super(options);
    this.options = options;
    this.ux = options.ux;
    this.shouldBePublished = options.shouldBePublished;
    this.env = new Env();
    this.registry = new Registry();
  }

  public install(silent = false): void {
    this.execCommand(`yarn install ${this.registry.getRegistryParameter()}`, silent);
  }

  public build(silent = false): void {
    this.execCommand('yarn build', silent);
  }

  public run(script: string, location?: string, silent = false): void {
    if (location) {
      this.execCommand(`(cd ${location} && yarn run ${script})`, silent);
    } else {
      this.execCommand(`(yarn run ${script})`, silent);
    }
  }

  public test(): void {
    this.execCommand('yarn test');
  }

  public getBranchName(): string {
    const branch =
      this.env.getString('CIRCLE_BRANCH', null) || exec('git branch --show-current', { silent: true }).stdout;
    return ensureString(branch);
  }

  public pushChangesToGit(): void {
    const branch = this.getBranchName();
    const cmd = `git push --set-upstream --no-verify --follow-tags origin ${branch}`;
    this.execCommand(cmd, false);
  }

  public stageChanges(): void {
    this.execCommand('git add .', false);
  }

  // eslint-disable-next-line class-methods-use-this
  public revertUnstagedChanges(): void {
    const changedFiles = exec('git diff --name-only', { silent: true })
      .stdout.split(os.EOL)
      .filter((f) => !!f);
    changedFiles.forEach((file) => {
      exec(`git checkout -- ${file}`, { silent: false });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  public revertAllChanges(): void {
    exec('git reset --hard HEAD', { silent: true });
  }

  public printStage(msg: string): void {
    this.ux.log(chalk.green.bold(`${os.EOL}${this.stepCounter}) ${msg}`));
    this.stepCounter += 1;
  }

  public async writeNpmToken(): Promise<void> {
    const home = this.env.getString('HOME') ?? os.homedir();
    await this.registry.setNpmAuth(home);
    await this.registry.setNpmRegistry(home);
  }

  protected execCommand(cmd: string, silent?: boolean): ShellString {
    if (!silent) this.ux.log(`${chalk.dim(cmd)}${os.EOL}`);
    const result = exec(cmd, { silent });
    if (result.code !== 0) {
      throw new SfError(result.stderr, 'FailedCommandExecution');
    } else {
      return result;
    }
  }

  protected async poll(checkFn: PollFunction): Promise<boolean> {
    const isNonTTY = this.env.getBoolean('CI') || this.env.getBoolean('CIRCLECI');
    let found = false;
    let attempts = 0;
    const maxAttempts = 300;
    const start = isNonTTY ? (msg: string): UX => this.ux.log(msg) : (msg: string): void => this.ux.startSpinner(msg);
    const update = isNonTTY
      ? (msg: string): UX => this.ux.log(msg)
      : (msg: string): void => this.ux.setSpinnerStatus(msg);
    const stop = isNonTTY ? (msg: string): UX => this.ux.log(msg) : (msg: string): void => this.ux.stopSpinner(msg);

    start('Polling for new version(s) to become available on npm');
    while (attempts < maxAttempts && !found) {
      attempts += 1;
      update(`attempt: ${attempts} of ${maxAttempts}`);
      found = checkFn();
      // eslint-disable-next-line no-await-in-loop
      await sleep(1000);
    }
    stop(attempts >= maxAttempts ? 'failed' : 'done');
    return found;
  }

  /**
   * If the commit type isn't fix (patch bump), feat (minor bump), or breaking (major bump),
   * then standard-version always defaults to a patch bump.
   * See https://github.com/conventional-changelog/standard-version/issues/577
   *
   * We, however, don't want to publish a new version for chore, docs, etc. So we analyze
   * the commits to see if any of them indicate that a new release should be published.
   */
  // eslint-disable-next-line class-methods-use-this
  protected async isReleasable(pkg: Package): Promise<boolean> {
    const commitInspection = await inspectCommits(pkg);
    return commitInspection.shouldRelease;
  }

  public abstract getSuccessMessage(): string;
  public abstract validate(): VersionValidation | VersionValidation[];
  public abstract prepare(options: PrepareOpts): void;
  public abstract getPkgInfo(packageNames?: string[]): PackageInfo | PackageInfo[];
  public abstract publish(options: PublishOpts): Promise<void>;
  public abstract sign(packageNames?: string[]): Promise<SigningResponse | SigningResponse[]>;
  public abstract waitForAvailability(): Promise<boolean>;
  protected abstract init(): Promise<void>;
}

export class PackageRepo extends Repository {
  public name: string;
  public nextVersion: string;
  public package: Package;
  public shouldBePublished: boolean;

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger: Logger;

  public constructor(options: RepositoryOptions) {
    super(options);
  }

  public validate(): VersionValidation {
    return this.package.validateNextVersion();
  }

  public prepare(opts: PrepareOpts = {}): void {
    const { dryrun } = opts;

    if (this.package.hasScript('version')) {
      this.run('version');
      this.stageChanges();
    }

    let cmd =
      'npx standard-version --commit-all --releaseCommitMessageFormat="chore(release): {{currentTag}} [ci skip]"';
    if (dryrun) cmd += ' --dry-run';

    cmd += ` --release-as ${this.nextVersion}`;
    this.execCommand(cmd);
  }

  public async sign(): Promise<SigningResponse> {
    packAndSignApi.setUx(this.ux);
    return packAndSignApi.packSignVerifyModifyPackageJSON(this.package.location);
  }

  // eslint-disable-next-line class-methods-use-this
  public async revertChanges(): Promise<void> {
    return packAndSignApi.revertPackageJsonIfExists();
  }

  public getPkgInfo(): PackageInfo {
    return {
      name: this.name,
      nextVersion: this.nextVersion,
      registryParam: this.registry.getRegistryParameter(),
    };
  }

  public async publish(opts: PublishOpts = {}): Promise<void> {
    const { dryrun, signatures, access, tag } = opts;
    if (!dryrun) await this.writeNpmToken();
    let cmd = 'npm publish';
    if (signatures?.[0]?.fileTarPath) cmd += ` ${signatures[0]?.fileTarPath}`;
    if (tag) cmd += ` --tag ${tag}`;
    if (dryrun) cmd += ' --dry-run';
    cmd += ` ${this.registry.getRegistryParameter()}`;
    cmd += ` --access ${access || 'public'}`;
    this.execCommand(cmd);
  }

  public async waitForAvailability(): Promise<boolean> {
    return this.poll(() => this.package.nextVersionIsAvailable());
  }

  public getSuccessMessage(): string {
    return chalk.green.bold(`Successfully released ${this.name}@${this.nextVersion}`);
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.package = await Package.create();
    this.shouldBePublished = await this.isReleasable(this.package);
    this.nextVersion = this.determineNextVersion();
    this.package.setNextVersion(this.nextVersion);

    this.name = this.package.npmPackage.name;
  }

  private determineNextVersion(): string {
    if (this.package.nextVersionIsHardcoded()) {
      this.logger.debug(
        `${this.package.packageJson.name}@${this.package.packageJson.version} does not exist in the registry. Assuming that it's the version we want published`
      );
      return this.package.packageJson.version;
    } else {
      this.logger.debug('Using standard-version to determine next version');
      let command = 'npx standard-version --dry-run --skip.tag --skip.commit --skip.changelog';
      // It can be an empty string if they want
      if (isString(this.options.useprerelease)) {
        command += ` --prerelease ${this.options.useprerelease}`;
      }
      const result = this.execCommand(command, true);
      const nextVersionRegex = /(?<=to\s)([0-9]{1,}\.|.){2,}/gi;
      return result.match(nextVersionRegex)[0];
    }
  }
}
