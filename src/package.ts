/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as os from 'os';
import { exec, ShellString } from 'shelljs';
import { fs, Logger, SfdxError } from '@salesforce/core';
import { AsyncOptionalCreatable, Env } from '@salesforce/kit';
import { AnyJson, Nullable } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import * as chalk from 'chalk';
import { upload } from './codeSigning/upload';
import { api as packAndSignApi, SigningResponse } from './codeSigning/packAndSign';

export type ProjectJson = {
  name: string;
  version: string;
} & AnyJson;

export type NpmPackage = {
  name: string;
  version: string;
  versions: string[];
  'dist-tags': string[];
} & AnyJson;

export function findPackageOnNpm(pkgName: string): Nullable<NpmPackage> {
  const result = exec(`npm view ${pkgName} --json`, { silent: true });
  return result.code === 0 ? (JSON.parse(result.stdout) as NpmPackage) : null;
}

function createDefaultNpmPackage(name: string, version: string): NpmPackage {
  return {
    name,
    version,
    versions: [],
    'dist-tags': [],
  };
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function readProjectJson(rootDir?: string): Promise<ProjectJson> {
  const pkgJsonPath = rootDir ? path.join(rootDir, 'package.json') : 'package.json';
  return (await fs.readJson(pkgJsonPath)) as ProjectJson;
}

let stepCount = 0;
export function getStepMsg(msg: string): string {
  stepCount += 1;
  return chalk.green.bold(`${os.EOL}${stepCount}) ${msg}`);
}

interface VersionValidation {
  nextVersion: string;
  currentVersion: string;
  valid: boolean;
}

interface PrepareOpts {
  dryrun?: boolean;
  tag?: string;
}

interface PublishOpts {
  dryrun?: boolean;
  tarfile?: string;
  tag?: string;
  access?: 'public' | 'restricted';
}

export class Package extends AsyncOptionalCreatable {
  public name!: string;
  public nextVersion!: string;

  // Both loggers are used because some logs we only want to show in the debug output
  // but other logs we always want to go to stdout
  private logger!: Logger;
  private ux: UX;

  private npmPackage!: NpmPackage;
  private projectJson!: ProjectJson;

  public constructor(ux: UX) {
    super();
    this.ux = ux;
  }

  public validateNextVersion(): VersionValidation {
    const nextVersionExists = this.npmPackage.versions.includes(this.nextVersion);
    if (!nextVersionExists) {
      this.logger.debug(`${this.npmPackage.name}@${this.nextVersion} does not exist in the registry. Proceeding...`);
      return {
        nextVersion: this.nextVersion,
        currentVersion: this.npmPackage.version,
        valid: true,
      };
    } else {
      this.logger.debug(`${this.npmPackage.name}@${this.nextVersion} already exists in the registry. Exiting...`);
      return {
        nextVersion: this.nextVersion,
        currentVersion: this.npmPackage.version,
        valid: false,
      };
    }
  }

  public determineNextVersion(): string {
    const versionExists = this.npmPackage.versions.includes(this.projectJson.version);
    if (!versionExists) {
      this.logger.debug(
        `${this.projectJson.name}@${this.projectJson.version} does not exist in the registry. Assuming that it's the version we want published`
      );
      return this.projectJson.version;
    } else {
      this.logger.debug('Using standard-version to determine next version');
      const result = exec('npx standard-version --dry-run --skip.tag --skip.commit --skip.changelog', { silent: true });
      const nextVersionRegex = /(?<=to\s)([0-9]{1,}\.|.){2,}/gi;
      return result.stdout.match(nextVersionRegex)[0];
    }
  }

  public install(silent = false): void {
    this.execCommand('yarn install', silent);
  }

  public build(silent = false): void {
    this.execCommand('yarn build', silent);
  }

  public prepare(opts?: PrepareOpts): void {
    const { dryrun } = opts;
    let cmd =
      'npx standard-version --commit-all --releaseCommitMessageFormat="chore(release): {{currentTag}} [ci skip]"';
    if (dryrun) cmd += ' --dry-run';
    // todo: tag prefix
    cmd += ` --release-as ${this.nextVersion}`;
    this.execCommand(cmd);

    if (!dryrun) this.pushGitTags();
  }

  public async sign(): Promise<SigningResponse> {
    const publickeyurl = 'https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt';
    const fingerprint = await packAndSignApi.retrieveFingerprint(publickeyurl);
    const env = new Env();
    env.setString('SFDX_DEVELOPER_TRUSTED_FINGERPRINT', fingerprint);

    const key = Buffer.from(env.getString('SALESFORCE_KEY'), 'base64').toString();
    const keyPath = path.join(os.tmpdir(), 'salesforce-cli.key');
    this.logger.debug(`Wrote salesforce key to ${keyPath}`);
    await fs.writeFile(keyPath, key);

    return packAndSignApi.doPackAndSign(
      {
        signatureurl: 'https://developer.salesforce.com/media/salesforce-cli/signatures',
        publickeyurl,
        privatekeypath: keyPath,
      },
      this.ux
    );

    // const cmd = [
    //   // 'sfdx-trust plugins:trust:sign',
    //   '/Users/mdonnalley/code/sfdx-trust/bin/run plugins:trust:sign',
    //   '--signatureurl https://developer.salesforce.com/media/salesforce-cli/signatures',
    //   '--publickeyurl https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt',
    //   `--privatekeypath ${keyPath}`,
    //   '--json',
    // ].join(' ');
    // const resp = this.execCommand(cmd).stdout;
    // const parsed = JSON.parse(resp);
    // return parsed.result;
  }

  public async uploadSignature(signResult: SigningResponse): Promise<void> {
    await upload(signResult.filename, 'dfc-data-production', 'media/salesforce-cli/signatures');
    // const cmd = [
    //   // 'sfdx-trust plugins:trust:upload',
    //   '/Users/mdonnalley/code/sfdx-trust/bin/run plugins:trust:upload',
    //   '--bucket dfc-data-production',
    //   '--keyprefix media/salesforce-cli/signatures',
    //   `--signature ${signResult.filename}`,
    // ].join(' ');
    // this.ux.log(cmd);
    // exec(cmd, { silent: false });
  }

  public verifySignature(): void {
    const cmd = `sfdx-trust plugins:trust:verify --npm ${this.npmPackage.name}@${this.nextVersion}`;
    this.execCommand(cmd);
  }

  public publish(opts?: PublishOpts): void {
    const { dryrun, tarfile, access, tag } = opts;
    let cmd = 'npm publish';
    if (tarfile) cmd += ` ${tarfile}`;
    if (tag) cmd += ` --tag ${tag}`;
    if (dryrun) cmd += ' --dry-run';
    cmd += ` --access ${access || 'public'}`;
    this.execCommand(cmd);
  }

  public async waitForVersionToExistOnNpm(): Promise<boolean> {
    let found = false;
    let attempts = 0;
    const maxAttempts = 300;
    this.ux.startSpinner('Polling for new version to become available on npm');
    while (attempts < maxAttempts && !found) {
      attempts += 1;
      this.ux.setSpinnerStatus(`attempt: ${attempts} of ${maxAttempts}`);
      const pkg = findPackageOnNpm(this.projectJson.name);
      if (pkg && pkg.versions && pkg.versions.includes(this.nextVersion)) {
        found = true;
      }
      await wait(1000);
    }
    this.ux.stopSpinner(attempts >= maxAttempts ? 'failed' : 'done');
    return found;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.projectJson = await readProjectJson();
    this.npmPackage =
      findPackageOnNpm(this.projectJson.name) ||
      createDefaultNpmPackage(this.projectJson.name, this.projectJson.version);
    this.nextVersion = this.determineNextVersion();
    this.name = this.npmPackage.name;
  }

  private execCommand(cmd: string, silent?: boolean): ShellString {
    if (!silent) this.ux.log(`${chalk.dim(cmd)}${os.EOL}`);
    const result = exec(cmd, { silent });
    if (result.code !== 0) {
      throw new SfdxError(result.stderr, 'FailedCommandExecution');
    } else {
      return result;
    }
  }

  private pushGitTags(): void {
    const currentBranch = exec('npx git branch --show-current', { silent: true }).stdout;
    const cmd = `npx git push --no-verify --follow-tags origin ${currentBranch}`;
    this.ux.log(cmd);
    exec(cmd, { silent: false });
  }
}
