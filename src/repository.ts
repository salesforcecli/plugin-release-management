/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import * as glob from 'glob';
import { pwd } from 'shelljs';
import { AnyJson } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { exec, ShellString } from 'shelljs';
import { fs, Logger, SfdxError } from '@salesforce/core';
import { AsyncOptionalCreatable, Env } from '@salesforce/kit';
import { get, Nullable } from '@salesforce/ts-types';
import * as chalk from 'chalk';
import { api as packAndSignApi, SigningResponse } from './codeSigning/packAndSign';
import { upload } from './codeSigning/upload';
import { Package, VersionValidation } from './package';

type LernaJson = {
  packages?: string[];
} & AnyJson;

interface PrepareOpts {
  dryrun?: boolean;
}

interface PublishOpts {
  dryrun?: boolean;
  signatures?: SigningResponse[];
  tag?: string;
  access?: 'public' | 'restricted';
}

interface VersionsByPackage {
  [key: string]: {
    currentVersion: string;
    nextVersion: string;
  };
}

export async function isMonoRepo(): Promise<boolean> {
  return fs.fileExists('lerna.json');
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class Signer extends AsyncOptionalCreatable {
  public static PUBLIC_KEY_URL = 'https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt';
  public static SIGNATURE_URL = 'https://developer.salesforce.com/media/salesforce-cli/signatures';
  public keyPath: string;
  private logger: Logger;
  private ux: UX;

  public constructor(ux: UX) {
    super(ux);
    this.ux = ux;
  }

  public async prepare(): Promise<void> {
    const fingerprint = await packAndSignApi.retrieveFingerprint(Signer.PUBLIC_KEY_URL);
    const env = new Env();
    env.setString('SFDX_DEVELOPER_TRUSTED_FINGERPRINT', fingerprint);

    const key = Buffer.from(env.getString('SALESFORCE_KEY'), 'base64').toString();
    this.keyPath = path.join(os.tmpdir(), 'salesforce-cli.key');
    await fs.writeFile(this.keyPath, key);
    this.logger.debug(`Wrote key to ${this.keyPath}`);
  }

  public async sign(target?: string): Promise<SigningResponse> {
    const repsonse = packAndSignApi.doPackAndSign(
      {
        signatureurl: Signer.SIGNATURE_URL,
        publickeyurl: Signer.PUBLIC_KEY_URL,
        privatekeypath: this.keyPath,
        target,
      },
      this.ux
    );
    await fs.unlink(this.keyPath);
    return repsonse;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    await this.prepare();
  }
}

abstract class Repository extends AsyncOptionalCreatable {
  protected ux: UX;
  private stepCounter = 1;

  public constructor(ux: UX) {
    super(ux);
    this.ux = ux;
  }

  public install(silent = false): void {
    this.execCommand('yarn install', silent);
  }

  public build(silent = false): void {
    this.execCommand('yarn build', silent);
  }

  public pushChangesToGit(): void {
    const currentBranch = exec('npx git branch --show-current', { silent: true }).stdout;
    const cmd = `npx git push --no-verify --follow-tags origin ${currentBranch}`;
    this.ux.log(cmd);
    exec(cmd, { silent: false });
  }

  public revertUnstagedChanges(): void {
    const changedFiles = exec('npx git diff --name-only', { silent: true })
      .stdout.split(os.EOL)
      .filter((f) => !!f);
    changedFiles.forEach((file) => {
      exec(`git checkout -- ${file}`, { silent: false });
    });
  }

  public printStage(msg: string): void {
    this.ux.log(chalk.green.bold(`${os.EOL}${this.stepCounter}) ${msg}`));
    this.stepCounter += 1;
  }

  public async uploadSignature(signResult: SigningResponse): Promise<void> {
    const result = await upload(signResult.filename, 'dfc-data-production', 'media/salesforce-cli/signatures');
    this.ux.log(`ETag: ${result.ETag}`);
    this.ux.log(`VersionId: ${result.VersionId}`);
  }

  protected execCommand(cmd: string, silent?: boolean): ShellString {
    if (!silent) this.ux.log(`${chalk.dim(cmd)}${os.EOL}`);
    const result = exec(cmd, { silent });
    if (result.code !== 0) {
      throw new SfdxError(result.stderr, 'FailedCommandExecution');
    } else {
      return result;
    }
  }

  public abstract getSuccessMessage(): string;
  public abstract validate(): VersionValidation | VersionValidation[];
  public abstract prepare(options: PrepareOpts): void;
  public abstract publish(options: PublishOpts): void;
  public abstract verifySignature(packageNames?: string[]): void;
  public abstract async sign(packageNames?: string[]): Promise<SigningResponse | SigningResponse[]>;
  public abstract async waitForAvailability(): Promise<boolean>;
  protected abstract async init(): Promise<void>;
}

export class MultiPackageRepo extends Repository {
  public packages: Package[] = [];

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger!: Logger;

  public constructor(ux: UX) {
    super(ux);
  }

  public validate(): VersionValidation[] {
    return this.packages.map((pkg) => pkg.validateNextVersion());
  }

  public prepare(opts: PrepareOpts = {}): void {
    if (opts.dryrun) {
      const cmd = 'npx lerna version --conventional-commits --yes --no-commit-hooks --no-push --no-git-tag-version';
      this.execCommand(cmd);
      this.revertUnstagedChanges();
    } else {
      const cmd =
        'npx lerna version --conventional-commits --yes --no-commit-hooks --no-push --message "chore(release): publish [ci skip]"';
      this.execCommand(cmd);
    }
  }

  public async sign(packageNames: string[]): Promise<SigningResponse[]> {
    const packages = this.packages.filter((pkg) => packageNames.includes(pkg.name));
    const responses: SigningResponse[] = [];
    const signer = await Signer.create(this.ux);
    for (const pkg of packages) {
      this.ux.log(chalk.dim(`Signing ${pkg.name} at ${pkg.location}`));
      const response = await signer.sign(pkg.location);
      responses.push(response);
    }
    return responses;
  }

  public publish(opts: PublishOpts = {}): void {
    const { dryrun, signatures, access, tag } = opts;
    const tarPathsByPkgName: { [key: string]: string } = (signatures || []).reduce((res, curr) => {
      res[curr.name] = curr.tarPath;
      return res;
    }, {});
    for (const pkg of this.packages) {
      const tarPath = tarPathsByPkgName[pkg.name];
      let cmd = 'npm publish';
      if (tarPath) cmd += ` ${tarPath}`;
      if (tag) cmd += ` --tag ${tag}`;
      if (dryrun) cmd += ' --dry-run';
      cmd += ` --access ${access || 'public'}`;
      this.execCommand(`(cd ${pkg.location} ; ${cmd})`);
    }
  }

  public async waitForAvailability(): Promise<boolean> {
    let found = false;
    let attempts = 0;
    const maxAttempts = 300;
    this.ux.startSpinner('Polling for new versions to become available on npm');
    while (attempts < maxAttempts && !found) {
      attempts += 1;
      this.ux.setSpinnerStatus(`attempt: ${attempts} of ${maxAttempts}`);
      found = this.packages.every((pkg) => pkg.nextVersionIsAvailable());
      await wait(1000);
    }
    this.ux.stopSpinner(attempts >= maxAttempts ? 'failed' : 'done');
    return found;
  }

  public verifySignature(packageNames: string[]): void {
    const packages = this.packages.filter((pkg) => packageNames.includes(pkg.name));
    for (const pkg of packages) {
      const cmd = `sfdx-trust plugins:trust:verify --npm ${pkg.name}@${pkg.getNextVersion()}`;
      this.execCommand(cmd);
    }
  }

  public getSuccessMessage(): string {
    const successes = this.packages.map((pkg) => `  - ${pkg.name}@${pkg.getNextVersion()}`).join(os.EOL);
    const header = chalk.green.bold(`${os.EOL}Successfully published:`);
    return `${header}${os.EOL}${successes}`;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    const pkgPaths = await this.getPackagePaths();
    const nextVersions = this.determineNextVersionByPackage();
    for (const pkgPath of pkgPaths) {
      const pkg = await Package.create(pkgPath);
      const nextVersion = nextVersions[pkg.name].nextVersion;
      pkg.setNextVersion(nextVersion);
      this.packages.push(pkg);
    }
  }

  private async getPackagePaths(): Promise<string[]> {
    const workingDir = pwd().stdout;
    const lernaJson = (await fs.readJson('lerna.json')) as LernaJson;
    const packageGlobs = lernaJson.packages || ['*'];
    const packages = packageGlobs
      .map((pGlob) => glob.sync(pGlob))
      .reduce((x, y) => x.concat(y), [])
      .map((pkg) => path.join(workingDir, pkg));
    return packages;
  }

  private determineNextVersionByPackage(): VersionsByPackage {
    const currentVersionRegex = /(?<=:\s)([0-9]{1,}\.|.){2,}(?=\s=>)/gi;
    const nextVersionsRegex = /(?<==>\s)([0-9]{1,}\.|.){2,}/gi;
    const pkgNameRegex = /(?<=-\s)(.*?)(?=:)/gi;
    const result = this.execCommand(
      'npx lerna version --conventional-commits --yes --no-changelog --no-commit-hooks --no-git-tag-version --no-push',
      true
    )
      .replace(`Changes:${os.EOL}`, '')
      .split(os.EOL)
      .filter((s) => !!s)
      .reduce((res, current) => {
        const currentVersion = current.match(currentVersionRegex)[0];
        const nextVersion = current.match(nextVersionsRegex)[0];
        const pkgName = current.match(pkgNameRegex)[0];
        res[pkgName] = { currentVersion, nextVersion };
        return res;
      }, {});
    this.logger.debug('determined the following version bumps:');
    this.logger.debug(result);
    // lerna modifies the package.json files so we want to reset them
    this.revertUnstagedChanges();
    return result;
  }
}

export class SinglePackageRepo extends Repository {
  public name: string;
  public nextVersion: string;
  public package: Package;

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger: Logger;

  public constructor(ux: UX) {
    super(ux);
  }

  public validate(): VersionValidation {
    return this.package.validateNextVersion();
  }

  public prepare(opts: PrepareOpts = {}): void {
    const { dryrun } = opts;
    let cmd =
      'npx standard-version --commit-all --releaseCommitMessageFormat="chore(release): {{currentTag}} [ci skip]"';
    if (dryrun) cmd += ' --dry-run';
    cmd += ` --release-as ${this.nextVersion}`;
    this.execCommand(cmd);
  }

  public async sign(): Promise<SigningResponse> {
    const signer = await Signer.create(this.ux);
    return signer.sign();
  }

  public verifySignature(): void {
    const cmd = `sfdx-trust plugins:trust:verify --npm ${this.name}@${this.nextVersion}`;
    this.execCommand(cmd);
  }

  public publish(opts: PublishOpts = {}): void {
    const { dryrun, signatures, access, tag } = opts;
    let cmd = 'npm publish';
    const tarPath = get(signatures, '0.tarPath', null) as Nullable<string>;
    if (tarPath) cmd += ` ${tarPath}`;
    if (tag) cmd += ` --tag ${tag}`;
    if (dryrun) cmd += ' --dry-run';
    cmd += ` --access ${access || 'public'}`;
    this.execCommand(cmd);
  }

  public async waitForAvailability(): Promise<boolean> {
    let found = false;
    let attempts = 0;
    const maxAttempts = 300;
    this.ux.startSpinner('Polling for new version to become available on npm');
    while (attempts < maxAttempts && !found) {
      attempts += 1;
      this.ux.setSpinnerStatus(`attempt: ${attempts} of ${maxAttempts}`);
      found = this.package.nextVersionIsAvailable();
      await wait(1000);
    }
    this.ux.stopSpinner(attempts >= maxAttempts ? 'failed' : 'done');
    return found;
  }

  public getSuccessMessage(): string {
    return chalk.green.bold(`Successfully released ${this.name}@${this.nextVersion}`);
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.package = await Package.create();

    this.nextVersion = this.determineNextVersion();
    this.package.setNextVersion(this.nextVersion);

    this.name = this.package.npmPackage.name;
  }

  private determineNextVersion(): string {
    const versionExists = this.package.npmPackage.versions.includes(this.package.projectJson.version);
    if (!versionExists) {
      this.logger.debug(
        `${this.package.projectJson.name}@${this.package.projectJson.version} does not exist in the registry. Assuming that it's the version we want published`
      );
      return this.package.projectJson.version;
    } else {
      this.logger.debug('Using standard-version to determine next version');
      const result = this.execCommand('npx standard-version --dry-run --skip.tag --skip.commit --skip.changelog', true);
      const nextVersionRegex = /(?<=to\s)([0-9]{1,}\.|.){2,}/gi;
      return result.match(nextVersionRegex)[0];
    }
  }
}
