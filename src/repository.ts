/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import os from 'node:os';
import { Ux } from '@salesforce/sf-plugins-core';
import shelljs from 'shelljs';
import { Logger, SfError } from '@salesforce/core';
import { AsyncOptionalCreatable, Env, sleep } from '@salesforce/kit';
import chalk from 'chalk';
import { isString } from '@salesforce/ts-types';
import { Package } from './package.js';
import { Registry } from './registry.js';
import { SigningResponse } from './codeSigning/SimplifiedSigning.js';
import { api as packAndSignApi } from './codeSigning/packAndSign.js';

export type Access = 'public' | 'restricted';

type PublishOpts = {
  dryrun?: boolean;
  signatures?: SigningResponse[];
  tag?: string;
  access?: Access;
};

export type PackageInfo = {
  name: string;
  nextVersion: string;
  registryParam: string;
};

type PollFunction = () => boolean;

type RepositoryOptions = {
  ux: Ux;
  useprerelease?: string;
  useoidc?: boolean;
};

abstract class Repository extends AsyncOptionalCreatable<RepositoryOptions> {
  protected options?: RepositoryOptions;
  protected ux: Ux;
  protected env: Env;
  protected registry: Registry;
  private stepCounter = 1;

  public constructor(options: RepositoryOptions | undefined) {
    super(options);
    this.options = options;
    this.ux = options?.ux ?? new Ux();
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

  public printStage(msg: string): void {
    this.ux.log(chalk.green.bold(`${os.EOL}${this.stepCounter}) ${msg}`));
    this.stepCounter += 1;
  }

  public async writeNpmToken(): Promise<void> {
    const home = this.env.getString('HOME') ?? os.homedir();
    if (!this.options?.useoidc) await this.registry.setNpmAuth(home);
    await this.registry.setNpmRegistry(home);
  }

  protected execCommand(cmd: string, silent?: boolean): shelljs.ShellString {
    if (!silent) this.ux.log(`${chalk.dim(cmd)}${os.EOL}`);
    const result = shelljs.exec(cmd, { silent });
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
    const start = isNonTTY
      ? (msg: string): void => this.ux.log(msg)
      : (msg: string): void => this.ux.spinner.start(msg);
    const update = isNonTTY
      ? (msg: string): void => this.ux.log(msg)
      : (msg: string): string => (this.ux.spinner.status = msg);
    const stop = isNonTTY ? (msg: string): void => this.ux.log(msg) : (msg: string): void => this.ux.spinner.stop(msg);

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

  public abstract getSuccessMessage(): string;
  public abstract getPkgInfo(packageNames?: string[]): PackageInfo | PackageInfo[];
  public abstract publish(options: PublishOpts): Promise<void>;
  public abstract sign(packageNames?: string[]): Promise<SigningResponse | SigningResponse[]>;
  public abstract waitForAvailability(): Promise<boolean>;
  protected abstract init(): Promise<void>;
}

export class PackageRepo extends Repository {
  // all props are set in init(), so ! is safe
  public name!: string;
  public nextVersion!: string;
  public package!: Package;

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger!: Logger;

  public constructor(options: RepositoryOptions | undefined) {
    super(options);
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
    cmd += ` --access ${access ?? 'public'}`;
    this.execCommand(cmd);
  }

  public async waitForAvailability(): Promise<boolean> {
    return this.poll(() => this.package.nextVersionIsAvailable(this.nextVersion));
  }

  public getSuccessMessage(): string {
    return chalk.green.bold(`Successfully released ${this.name}@${this.nextVersion}`);
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.package = await Package.create({ location: undefined });
    this.nextVersion = this.determineNextVersion();

    this.name = this.package.npmPackage.name;
  }

  private determineNextVersion(): string {
    if (this.package.nextVersionIsHardcoded()) {
      this.logger.debug(
        `${this.package.packageJson.name}@${this.package.packageJson.version} does not exist in the registry. Assuming that it's the version we want published`
      );
      return this.package.packageJson.version;
    } else {
      this.logger.debug('Using commit-and-tag-version to determine next version');
      let command = 'npx commit-and-tag-version --dry-run --skip.tag --skip.commit --skip.changelog';
      // It can be an empty string if they want
      if (isString(this.options?.useprerelease)) {
        command += ` --prerelease ${this.options?.useprerelease}`;
      }
      const result = this.execCommand(command, true);
      const nextVersionRegex = /(?<=to\s)([0-9]{1,}\.|.){2,}/gi;
      const nextVersion = result.match(nextVersionRegex)?.[0];
      if (!nextVersion) {
        throw new SfError(`Could not determine next version from ${result} using regex`);
      }
      return nextVersion;
    }
  }
}
