/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';
import * as glob from 'glob';
import { pwd } from 'shelljs';
import { AnyJson, ensureString, getString } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { exec, ShellString } from 'shelljs';
import { fs, Logger, SfdxError } from '@salesforce/core';
import { AsyncOptionalCreatable, Env, isEmpty, sleep } from '@salesforce/kit';
import { Nullable, isString } from '@salesforce/ts-types';
import * as chalk from 'chalk';
import * as conventionalCommitsParser from 'conventional-commits-parser';
import * as conventionalChangelogPresetLoader from 'conventional-changelog-preset-loader';
import { api as packAndSignApi, SigningResponse } from './codeSigning/packAndSign';
import { upload } from './codeSigning/upload';
import { Package, VersionValidation } from './package';
import { Registry } from './registry';

type LernaJson = {
  packages?: string[];
} & AnyJson;

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

interface VersionsByPackage {
  [key: string]: {
    currentVersion: string;
    nextVersion: string;
  };
}

interface Commit {
  type: Nullable<string>;
  header: Nullable<string>;
  body: Nullable<string>;
}

type PollFunction = () => boolean;

export async function isMonoRepo(): Promise<boolean> {
  return fs.fileExists('lerna.json');
}

export class Signer extends AsyncOptionalCreatable {
  public static DEFAULT_PUBLIC_KEY_URL = 'https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt';
  public static DEFAULT_SIGNATURE_URL = 'https://developer.salesforce.com/media/salesforce-cli/signatures';
  public keyPath: string;
  public publicKeyUrl: string;
  public signatureUrl: string;

  private logger: Logger;
  private ux: UX;
  private env: Env;

  public constructor(ux: UX) {
    super(ux);
    this.ux = ux;
    this.env = new Env();
    this.publicKeyUrl = this.env.getString('SFDX_PUBLIC_KEY_URL', Signer.DEFAULT_PUBLIC_KEY_URL);
    this.signatureUrl = this.env.getString('SFDX_SIGNATURE_URL', Signer.DEFAULT_SIGNATURE_URL);
  }

  public async prepare(): Promise<void> {
    const key = Buffer.from(this.env.getString('SALESFORCE_KEY'), 'base64').toString();
    this.keyPath = path.join(os.tmpdir(), 'salesforce-cli.key');
    await fs.writeFile(this.keyPath, key);
    this.logger.debug(`Wrote key to ${this.keyPath}`);
  }

  public async sign(target?: string): Promise<SigningResponse> {
    packAndSignApi.setUx(this.ux);
    const repsonse = await packAndSignApi.doPackAndSign({
      signatureurl: this.signatureUrl,
      publickeyurl: this.publicKeyUrl,
      privatekeypath: this.keyPath,
      target,
    });
    await fs.unlink(this.keyPath);
    return repsonse;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    await this.prepare();
  }
}

export type RepositoryOptions = {
  ux: UX;
  useprerelease?: string;
};

abstract class Repository extends AsyncOptionalCreatable<RepositoryOptions> {
  protected options: RepositoryOptions;
  protected ux: UX;
  protected env: Env;
  protected registry: Registry;
  private stepCounter = 1;

  public constructor(options: RepositoryOptions) {
    super(options);
    this.options = options;
    this.ux = options.ux;
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
      this.env.getString('CIRCLE_BRANCH', null) || exec('npx git branch --show-current', { silent: true }).stdout;
    return ensureString(branch);
  }

  public pushChangesToGit(): void {
    const branch = this.getBranchName();
    const cmd = `npx git push --set-upstream --no-verify --follow-tags origin ${branch}`;
    this.execCommand(cmd, false);
  }

  public stageChanges(): void {
    this.execCommand('npx git add .', false);
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

  public async writeNpmToken(): Promise<void> {
    const home = this.env.getString('HOME') ?? os.homedir();
    await this.registry.setNpmAuth(home);
    await this.registry.setNpmRegistry(home);
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
      await sleep(1000);
    }
    stop(attempts >= maxAttempts ? 'failed' : 'done');
    return found;
  }

  /**
   * Returns true if the tag on the current commit matches the version passed in
   *
   * @returns boolean
   */
  protected tagMatchesPackageVersion(packageVersion: string): boolean {
    // Get the tag pointing to the current commit
    const currentTag = this.execCommand('git tag --points-at HEAD').trim();
    if (!currentTag) return false;

    // Remove potential leading v from version tag
    return currentTag.replace(/^v/, '') === packageVersion;
  }

  /**
   * If the commit type isn't fix (patch bump), feat (minor bump), or breaking (major bump),
   * then standard-version always defaults to a patch bump.
   * See https://github.com/conventional-changelog/standard-version/issues/577
   *
   * We, however, don't want to publish a new version for chore, docs, etc. So we analyze
   * the commits to see if any of them indicate that a new release should be published.
   */
  protected async isReleasable(pkg: Package, lerna = false): Promise<boolean> {
    // If the tag on the current commit does not match the package version don't release this
    if (!this.tagMatchesPackageVersion(pkg.packageJson.version)) return false;

    // Return true if the version bump is hardcoded in the package.json
    // In this scenario, we want to publish regardless of the commit types
    if (pkg.nextVersionIsHardcoded()) return true;

    const skippableCommitTypes = ['chore', 'style', 'docs', 'ci', 'test'];

    // TODO: Fix how lerna repos get the previousTag because this is broken now that we're only deploying on a commit with a version tag on it
    // Find the previous git tag so that we can get all the commits that have happened since
    const tags = this.execCommand('git fetch --tags && git tag', true).stdout.split(os.EOL);
    const previousTag = lerna
      ? tags.find((tag) => tag.includes(`${pkg.name}@${pkg.npmPackage.version}`)) || ''
      : this.execCommand('git describe --abbrev=0 $(git rev-list HEAD -n 1 --skip 1)').trim();

    // import the default commit parser configuration
    const defaultConfigPath = require.resolve('conventional-changelog-conventionalcommits');
    const configuration = await conventionalChangelogPresetLoader({ name: defaultConfigPath });

    const commits: Commit[] = await new Promise((resolve) => {
      const DELIMITER = 'SPLIT';
      const gitLogCommand = lerna
        ? `git log --format=%B%n-hash-%n%H%n${DELIMITER} ${previousTag}..HEAD --no-merges -- ${pkg.location}`
        : `git log --format=%B%n-hash-%n%H%n${DELIMITER} ${previousTag}..HEAD --no-merges`;
      const gitLog = this.execCommand(gitLogCommand, true)
        .stdout.split(`${DELIMITER}${os.EOL}`)
        .filter((c) => !!c);
      const readable = Readable.from(gitLog);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore because the type exported from conventionalCommitsParser is wrong
      const parser = readable.pipe(conventionalCommitsParser(configuration.parserOpts));
      const allCommits: Commit[] = [];
      parser.on('data', (commit: Commit) => allCommits.push(commit));
      parser.on('finish', () => resolve(allCommits));
    });

    const commitsThatWarrantRelease = commits.filter((commit) => {
      const headerIndicatesMajorChange = !!commit.header && commit.header.includes('!');
      const bodyIndicatesMajorChange = !!commit.body && commit.body.includes('BREAKING');
      const typeIsSkippable = skippableCommitTypes.includes(commit.type);
      return !typeIsSkippable || bodyIndicatesMajorChange || headerIndicatesMajorChange;
    });
    return commitsThatWarrantRelease.length > 0;
  }

  public abstract getSuccessMessage(): string;
  public abstract validate(): VersionValidation | VersionValidation[];
  public abstract prepare(options: PrepareOpts): void;
  public abstract verifySignature(packageNames?: string[]): void;
  public abstract publish(options: PublishOpts): Promise<void>;
  public abstract sign(packageNames?: string[]): Promise<SigningResponse | SigningResponse[]>;
  public abstract waitForAvailability(): Promise<boolean>;
  protected abstract init(): Promise<void>;
}

export class LernaRepo extends Repository {
  public packages: Package[] = [];

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger!: Logger;

  public constructor(options: RepositoryOptions) {
    super(options);
  }

  public validate(): VersionValidation[] {
    return this.packages.map((pkg) => pkg.validateNextVersion());
  }

  public prepare(opts: PrepareOpts = {}): void {
    const { dryrun, githubRelease } = opts;

    this.packages.forEach((pkg) => {
      if (pkg.hasScript('version')) {
        this.run('version', pkg.location);
        this.stageChanges();
      }
    });

    let cmd = 'npx lerna version --conventional-commits --yes --no-commit-hooks --no-push';
    if (dryrun) cmd += ' --no-git-tag-version';
    if (!dryrun && githubRelease) cmd += ' --create-release github';
    if (!dryrun) cmd += ' --message "chore(release): publish [ci skip]"';
    this.execCommand(cmd);
    if (dryrun) {
      this.revertUnstagedChanges();
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

  public async publish(opts: PublishOpts = {}): Promise<void> {
    const { dryrun, signatures, access, tag } = opts;
    if (!dryrun) await this.writeNpmToken();
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
      cmd += ` ${this.registry.getRegistryParameter()}`;
      cmd += ` --access ${access || 'public'}`;
      this.execCommand(`(cd ${pkg.location} ; ${cmd})`);
    }
  }

  public async waitForAvailability(): Promise<boolean> {
    return this.poll(() => {
      return this.packages.every((pkg) => pkg.nextVersionIsAvailable());
    });
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
    if (!isEmpty(nextVersions)) {
      for (const pkgPath of pkgPaths) {
        const pkg = await Package.create(pkgPath);
        const shouldBePublihsed = await this.isReleasable(pkg, true);
        const nextVersion = getString(nextVersions, `${pkg.name}.nextVersion`, null);
        if (shouldBePublihsed && nextVersion) {
          pkg.setNextVersion(nextVersion);
          this.packages.push(pkg);
        }
      }
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
        try {
          const currentVersion = current.match(currentVersionRegex)[0];
          const nextVersion = current.match(nextVersionsRegex)[0];
          const pkgName = current.match(pkgNameRegex)[0];
          res[pkgName] = { currentVersion, nextVersion };
          return res;
        } catch {
          return res;
        }
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

    let cmd = 'npx standard-version --commit-all --releaseCommitMessageFormat="chore(release): {{currentTag}}"';
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

  public async publish(opts: PublishOpts = {}): Promise<void> {
    const { dryrun, signatures, access, tag } = opts;
    if (!dryrun) await this.writeNpmToken();
    let cmd = 'npm publish';
    const tarPath = getString(signatures, '0.tarPath', null);
    if (tarPath) cmd += ` ${tarPath}`;
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
