/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { exec } from 'shelljs';
import { ux } from '@oclif/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import got from 'got';
import * as chalk from 'chalk';
import { Channel, CLI, ServiceAvailability } from '../../../types';
import { AmazonS3 } from '../../../amazonS3';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.install.test');

type Results = Record<string, Record<CLI, boolean>>;

namespace Method {
  export enum Type {
    INSTALLER = 'installer',
    NPM = 'npm',
    TARBALL = 'tarball',
  }

  export interface Options {
    cli: CLI;
    channel: Channel;
    method: Type;
    directory: string;
  }

  export abstract class Base {
    private static TEST_TARGETS = {
      [CLI.SF]: [CLI.SF],
      [CLI.SFDX]: [CLI.SFDX, CLI.SF],
    };

    public constructor(protected options: Method.Options) {}

    public async execute(): Promise<Results> {
      const { service, available } = await this.ping();
      if (!available) {
        ux.warn(`${service} is not currently available.`);
        const results: Results = {
          [this.options.method]: {} as Record<CLI, boolean>,
        };
        for (const cli of this.getTargets()) {
          results[this.options.method][cli] = false;
        }
        return results;
      }
      switch (process.platform) {
        case 'darwin': {
          return this.darwin();
        }
        case 'win32': {
          return this.win32();
        }
        case 'linux': {
          return this.linux();
        }
        default:
          break;
      }
      return {};
    }

    // eslint-disable-next-line class-methods-use-this
    protected async ping(): Promise<ServiceAvailability> {
      return Promise.resolve({ available: true, service: 'Service' });
    }

    // eslint-disable-next-line class-methods-use-this
    protected logResult(cli: CLI, success: boolean): void {
      const msg = success ? chalk.green('true') : chalk.red('false');
      ux.log(`${chalk.bold(`${cli} Success`)}: ${msg}`);
    }

    protected getTargets(): CLI[] {
      return Base.TEST_TARGETS[this.options.cli];
    }

    public abstract darwin(): Promise<Results>;
    public abstract win32(): Promise<Results>;
    public abstract linux(): Promise<Results>;
  }
}

class Tarball extends Method.Base {
  private s3: AmazonS3;
  private paths = {
    darwin: ['x64.tar.gz', 'x64.tar.xz'],
    win32: [
      'x64.tar.gz',
      'x86.tar.gz',
      // .xz is not supported by powershell's tar command
      // 'x64.tar.xz',
      // 'x86.tar.xz'
    ],
    linux: ['x64.tar.gz', 'x64.tar.xz'],
    'linux-arm': ['arm.tar.gz', 'arm.tar.xz'],
  };

  public constructor(protected options: Method.Options) {
    super(options);
    this.s3 = new AmazonS3({ cli: options.cli, channel: options.channel });
  }

  public async darwin(): Promise<Results> {
    return this.installAndTest('darwin');
  }

  public async win32(): Promise<Results> {
    return this.installAndTest('win32');
  }

  public async linux(): Promise<Results> {
    return this.installAndTest('linux');
  }

  protected async ping(): Promise<ServiceAvailability> {
    return this.s3.ping();
  }

  private async installAndTest(platform: Extract<NodeJS.Platform, 'darwin' | 'linux' | 'win32'>): Promise<Results> {
    const tarballs = this.getTarballs(platform);
    const results: Results = {};
    for (const [tarball, location] of Object.entries(tarballs)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.s3.download(tarball, location);
        // eslint-disable-next-line no-await-in-loop
        const extracted = await this.extract(location);
        const testResults = this.test(extracted);
        for (const [cli, success] of Object.entries(testResults)) {
          this.logResult(cli as CLI, success);
        }
        results[tarball] = testResults;
      } catch {
        results[tarball] = {} as Record<CLI, boolean>;
        for (const cli of this.getTargets()) {
          results[tarball][cli] = false;
        }
      }
      ux.log();
    }
    return results;
  }

  private getTarballs(platform: Extract<NodeJS.Platform, 'darwin' | 'linux' | 'win32'>): Record<string, string> {
    const paths = platform === 'linux' && os.arch().includes('arm') ? this.paths['linux-arm'] : this.paths[platform];
    const s3Tarballs = paths.map(
      (p) => `${this.s3.directory}/channels/${this.options.channel}/${this.options.cli}-${platform}-${p}`
    );

    const tarballs: Record<string, string> = {};
    for (const tarball of s3Tarballs) {
      const name = path.basename(tarball);
      const location = path.join(this.options.directory, name);
      tarballs[tarball] = location;
    }

    return tarballs;
  }

  private async extract(file: string): Promise<string> {
    const dir = path.join(this.options.directory, path.basename(file).replace(/\./g, '-'));
    await fs.mkdir(dir, { recursive: true });
    return new Promise((resolve, reject) => {
      ux.action.start(`Unpacking ${chalk.cyan(path.basename(file))} to ${dir}`);
      const cmd =
        process.platform === 'win32'
          ? `tar -xf ${file} -C ${dir} --strip-components 1 --exclude node_modules/.bin`
          : `tar -xf ${file} -C ${dir} --strip-components 1`;
      const opts = process.platform === 'win32' ? { shell: 'powershell.exe' } : {};
      exec(cmd, { ...opts, silent: true }, (code: number, stdout: string, stderr: string) => {
        if (code === 0) {
          ux.action.stop();
          ux.log(stdout);
          resolve(dir);
        } else {
          ux.log('stdout:', stdout);
          ux.log('stderr:', stderr);
          reject();
        }
      });
    });
  }

  private test(directory: string): Record<CLI, boolean> {
    const results = {} as Record<CLI, boolean>;
    for (const cli of this.getTargets()) {
      const executable = path.join(directory, 'bin', cli);
      ux.log(`Testing ${chalk.cyan(executable)}`);
      const result =
        process.platform === 'win32' ? exec(`cmd /c "${executable}.cmd" --version`) : exec(`${executable} --version`);
      results[cli] = result.code === 0;
    }
    return results;
  }
}

class Npm extends Method.Base {
  private static STATUS_URL = 'https://status.npmjs.org/api/v2/status.json';
  private package: string;

  public constructor(protected options: Method.Options) {
    super(options);
    const name = options.cli === CLI.SF ? '@salesforce/cli' : 'sfdx-cli';
    const tag = options.channel === Channel.STABLE ? 'latest' : 'latest-rc';
    this.package = `${name}@${tag}`;
  }

  public async darwin(): Promise<Results> {
    return this.installAndTest();
  }

  public async win32(): Promise<Results> {
    return this.installAndTest();
  }

  public async linux(): Promise<Results> {
    return this.installAndTest();
  }

  // eslint-disable-next-line class-methods-use-this
  protected async ping(): Promise<ServiceAvailability> {
    // I'm not confident that this is the best way to preempt any issues related to Npm's availability. Mainly
    // because I couldn't find any documentation related to what status indicators might be used and when.
    const response = await got.get(Npm.STATUS_URL).json<{ status: { indicator: string; description: string } }>();
    return { service: 'Npm', available: ['none', 'minor'].includes(response.status.indicator) };
  }

  private async installAndTest(): Promise<Results> {
    try {
      await this.install();
    } catch {
      const results = {} as Record<CLI, boolean>;
      for (const cli of this.getTargets()) {
        results[cli] = false;
      }
      return { [this.package]: results };
    }

    const testResults = this.test();
    for (const [cli, success] of Object.entries(testResults)) {
      this.logResult(cli as CLI, success);
    }
    ux.log();
    return { [this.package]: testResults };
  }

  private async install(): Promise<void> {
    ux.action.start(`Installing: ${chalk.cyan(this.package)}`);
    return new Promise((resolve, reject) => {
      exec(`npm install ${this.package}`, { silent: true, cwd: this.options.directory }, (code, stdout, stderr) => {
        if (code === 0) {
          ux.action.stop();
          ux.log(stdout);
          resolve();
        } else {
          ux.action.stop('Failed');
          ux.log(stdout);
          ux.log(stderr);
          reject();
        }
      });
    });
  }

  private test(): Record<CLI, boolean> {
    const results = {} as Record<CLI, boolean>;
    const executable = path.join(this.options.directory, 'node_modules', '.bin', this.options.cli);
    ux.log(`Testing ${chalk.cyan(executable)}`);

    const result =
      process.platform === 'win32' ? exec(`cmd /c "${executable}" --version`) : exec(`${executable} --version`);
    results[this.options.cli] = result.code === 0;
    return results;
  }
}

class Installer extends Method.Base {
  private s3: AmazonS3;

  public constructor(protected options: Method.Options) {
    super(options);
    this.s3 = new AmazonS3({ cli: options.cli, channel: options.channel });
  }

  public async darwin(): Promise<Results> {
    const pkg = `${this.options.cli}.pkg`;
    const url = `${this.s3.directory}/channels/${this.options.channel}/${pkg}`;
    const location = path.join(this.options.directory, pkg);
    await this.s3.download(url, location);
    const result = exec(`sudo installer -pkg ${location} -target /`);
    const results: Results = {};
    if (result.code === 0) {
      const testResults = this.nixTest();
      for (const [cli, success] of Object.entries(testResults)) {
        this.logResult(cli as CLI, success);
      }
      results[url] = testResults;
    } else {
      results[url] = {} as Record<CLI, boolean>;
      for (const cli of this.getTargets()) {
        this.logResult(this.options.cli, false);
        results[url][cli] = false;
      }
    }
    ux.log();
    return results;
  }

  public async win32(): Promise<Results> {
    const executables = [`${this.options.cli}-x64.exe`, `${this.options.cli}-x86.exe`];
    const results: Results = {};
    for (const exe of executables) {
      const url = `${this.s3.directory}/channels/${this.options.channel}/${exe}`;
      const location = path.join(this.options.directory, exe);
      // eslint-disable-next-line no-await-in-loop
      await this.s3.download(url, location);
      const installLocation = `C:\\install-test\\${this.options.cli}\\${exe.includes('x86') ? 'x86' : 'x64'}`;
      const cmd = `Start-Process -Wait -FilePath "${location}" -ArgumentList "/S", "/D=${installLocation}" -PassThru`;
      ux.log(`Installing ${chalk.cyan(exe)} to ${installLocation}...`);
      const result = exec(cmd, { shell: 'powershell.exe' });
      if (result.code === 0) {
        const testResults = this.win32Test(installLocation);
        for (const [cli, success] of Object.entries(testResults)) {
          this.logResult(cli as CLI, success);
        }
        results[url] = testResults;
      } else {
        results[url] = {} as Record<CLI, boolean>;
        for (const cli of this.getTargets()) {
          this.logResult(this.options.cli, false);
          results[url][cli] = false;
        }
      }
    }

    return results;
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async linux(): Promise<Results> {
    throw new Error('Installers not supported for linux.');
  }

  protected async ping(): Promise<ServiceAvailability> {
    return this.s3.ping();
  }

  private win32Test(installLocation: string): Record<CLI, boolean> {
    const results = {} as Record<CLI, boolean>;
    for (const cli of this.getTargets()) {
      const binaryPath = path.join(installLocation, 'bin', `${cli}.cmd`);
      ux.log(`Testing ${chalk.cyan(binaryPath)}`);
      const result = exec(`cmd /c "${binaryPath}" --version`);
      results[cli] =
        result.code === 0 && binaryPath.includes('x86')
          ? result.stdout.includes('win32-x86')
          : result.stdout.includes('win32-x64');
    }
    return results;
  }

  private nixTest(): Record<CLI, boolean> {
    const results = {} as Record<CLI, boolean>;
    for (const cli of this.getTargets()) {
      const binaryPath = `/usr/local/bin/${cli}`;
      ux.log(`Testing ${chalk.cyan(binaryPath)}`);
      const result = exec(`${binaryPath} --version`);
      results[cli] = result.code === 0;
    }
    return results;
  }
}

export default class Test extends SfCommand<void> {
  public static readonly description = messages.getMessage('description');
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    cli: Flags.string({
      summary: messages.getMessage('cliFlag'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    method: Flags.string({
      summary: messages.getMessage('methodFlag'),
      options: Object.values(Method.Type),
      char: 'm',
      required: true,
    }),
    channel: Flags.string({
      summary: messages.getMessage('channelFlag'),
      options: Object.values(Channel),
      default: 'stable',
    }),
    'output-file': Flags.string({
      summary: messages.getMessage('outputFileFlag'),
      default: 'test-results.json',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Test);
    const cli = ensure<CLI>(flags.cli as CLI);
    const method = ensure<Method.Type>(flags.method as Method.Type);
    const channel = ensure<Channel>(flags.channel as Channel);
    const outputFile = ensure<string>(flags['output-file']);
    const directory = await makeWorkingDir(cli, channel, method);

    ux.log(`Working Directory: ${directory}`);
    ux.log();

    let results: Results = {};
    switch (method) {
      case 'tarball': {
        const tarball = new Tarball({ cli, channel, directory, method });
        results = await tarball.execute();
        break;
      }
      case 'npm': {
        const npm = new Npm({ cli, channel, directory, method });
        results = await npm.execute();
        break;
      }
      case 'installer': {
        const installer = new Installer({ cli, channel, directory, method });
        results = await installer.execute();
        break;
      }
      default:
        break;
    }
    const hasFailures = Object.values(results)
      .flatMap(Object.values)
      .some((r) => !r);
    if (hasFailures) process.exitCode = 1;

    const fileData: string = JSON.stringify({ status: process.exitCode ?? 0, results }, null, 2);
    await fs.writeFile(outputFile, fileData, {
      encoding: 'utf8',
      mode: '600',
    });
    ux.styledJSON(results);
    ux.log(`Results written to ${outputFile}`);
  }
}

const makeWorkingDir = async (cli: CLI, channel: Channel, method: Method.Type): Promise<string> => {
  const tmpDir = path.join(os.tmpdir(), 'cli-install-test', cli, channel, method);
  // ensure that we are starting with a clean directory
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // error means that folder doesn't exist which is okay
  }
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
};
