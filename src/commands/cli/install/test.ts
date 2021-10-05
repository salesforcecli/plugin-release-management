/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand, UX } from '@salesforce/command';
import { fs, Messages } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import got from 'got';
import { exec } from 'shelljs';
import * as chalk from 'chalk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.install');

enum CLI {
  SF = 'sf',
  SFDX = 'sfdx',
}

enum Channel {
  STABLE = 'stable',
  STABLE_RC = 'stable-rc',
}

export type Results = Record<string, boolean>;
export type ServiceAvailability = { service: string; available: boolean };

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
    public constructor(protected options: Method.Options, protected ux: UX) {}

    public async execute(): Promise<Results> {
      const { service, available } = await this.ping();
      if (!available) {
        throw new Error(`${service} is not currently available. Unable to run installation tests...`);
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

    protected async ping(): Promise<ServiceAvailability> {
      return Promise.resolve({ available: true, service: 'Service' });
    }

    protected logResult(success: boolean): void {
      const msg = success ? chalk.green('true') : chalk.red('false');
      this.ux.log(`${chalk.bold('Success')}: ${msg}`);
      this.ux.log();
    }

    public abstract darwin(): Promise<Results>;
    public abstract win32(): Promise<Results>;
    public abstract linux(): Promise<Results>;
  }
}

class AmazonS3 {
  public static STATUS_URL = 'https://s3.amazonaws.com';

  public directory: string;

  public constructor(cli: CLI, channel: Channel, private ux: UX) {
    this.directory = `https://developer.salesforce.com/media/salesforce-cli/${cli}/channels/${channel}`;
  }

  public async ping(): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(AmazonS3.STATUS_URL);
    return { service: 'Amazon S3', available: statusCode >= 200 && statusCode < 300 };
  }

  public async download(url: string, location: string): Promise<void> {
    const downloadStream = got.stream(url);
    const fileWriterStream = fs.createWriteStream(location);
    return new Promise((resolve) => {
      downloadStream.on('error', (error) => {
        this.ux.error(`Download failed: ${error.message}`);
      });

      fileWriterStream
        .on('error', (error) => {
          this.ux.stopSpinner('Failed');
          this.ux.error(`Could not write file to system: ${error.message}`);
        })
        .on('finish', () => {
          this.ux.stopSpinner();
          resolve();
        });
      this.ux.startSpinner(`Downloading ${chalk.cyan(url)}`);
      downloadStream.pipe(fileWriterStream);
    });
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

  public constructor(protected options: Method.Options, protected ux: UX) {
    super(options, ux);
    this.s3 = new AmazonS3(options.cli, options.channel, ux);
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
        await this.s3.download(tarball, location);
        const extracted = await this.extract(location);
        const success = this.test(extracted);
        this.logResult(success);
        results[tarball] = success;
      } catch {
        results[tarball] = false;
      }
    }
    return results;
  }

  private getTarballs(platform: Extract<NodeJS.Platform, 'darwin' | 'linux' | 'win32'>): Record<string, string> {
    const paths = platform === 'linux' && os.arch().includes('arm') ? this.paths['linux-arm'] : this.paths[platform];
    const s3Tarballs = paths.map((p) => {
      return `${this.s3.directory}/${this.options.cli}-${platform}-${p}`;
    });

    const tarballs: Record<string, string> = {};
    for (const tarball of s3Tarballs) {
      const name = path.basename(tarball);
      const location = path.join(this.options.directory, name);
      tarballs[tarball] = location;
    }

    return tarballs;
  }

  private async extract(file: string): Promise<string> {
    const dir = path.join(this.options.directory, path.basename(file).replace(/./g, '-'));
    await fs.mkdirp(dir);
    return new Promise((resolve, reject) => {
      this.ux.startSpinner(`Unpacking ${chalk.cyan(path.basename(file))}`);
      const cmd =
        process.platform === 'win32'
          ? `tar -xf ${file} -C ${dir} --strip-components 1 --exclude node_modules/.bin`
          : `tar -xf ${file} -C ${dir} --strip-components 1`;
      const opts =
        process.platform === 'win32'
          ? { silent: true, async: true, shell: 'powershell.exe' }
          : { silent: true, async: true };
      exec(cmd, opts, (code: number, stdout: string, stderr: string) => {
        if (code === 0) {
          this.ux.stopSpinner();
          resolve(dir);
        } else {
          this.ux.stopSpinner('Failed');
          this.ux.log('code:', code.toString());
          this.ux.log('stdout:', stdout);
          this.ux.log('stderr:', stderr);
          reject();
        }
      });
    });
  }

  private test(directory: string): boolean {
    const executable = path.join(
      directory,
      'bin',
      process.platform === 'win32' ? `${this.options.cli}.cmd` : this.options.cli
    );
    this.ux.log(`Testing ${chalk.cyan(executable)}`);
    const result = exec(`${executable} --version`, { silent: false });
    this.ux.log(chalk.dim((result.stdout ?? result.stderr).replace(/\n*$/, '')));
    return result.code === 0;
  }
}

class Npm extends Method.Base {
  private static STATUS_URL = 'https://status.npmjs.org/api/v2/status.json';
  private package: string;

  public constructor(protected options: Method.Options, protected ux: UX) {
    super(options, ux);
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

  protected async ping(): Promise<ServiceAvailability> {
    // I'm not confident that this is the best way to preempt any issues related to Npm's availability. Mainly
    // because I couldn't find any documetation related to what status indicators might be used and when.
    const response = await got.get(Npm.STATUS_URL).json<{ status: { indicator: string; description: string } }>();
    return { service: 'Npm', available: response.status.indicator === 'none' };
  }

  private async installAndTest(): Promise<Results> {
    await this.install();
    const success = this.test();
    this.logResult(success);
    return { [this.package]: true };
  }

  private async install(): Promise<void> {
    this.ux.startSpinner(`Installing: ${chalk.cyan(this.package)}`);
    return new Promise((resolve, reject) => {
      exec(`npm install ${this.package}`, { silent: true, cwd: this.options.directory, async: true }, (code) => {
        if (code === 0) {
          this.ux.stopSpinner();
          resolve();
        } else {
          this.ux.stopSpinner('Failed');
          reject();
        }
      });
    });
  }

  private test(): boolean {
    const executable = path.join(this.options.directory, 'node_modules', '.bin', this.options.cli);
    this.ux.log(`Testing ${chalk.cyan(executable)}`);
    const result = exec(`${executable} --version`, { silent: true });
    this.ux.log(chalk.dim((result.stdout ?? result.stderr).replace(/\n*$/, '')));
    return result.code === 0;
  }
}

class Installer extends Method.Base {
  private s3: AmazonS3;

  public constructor(protected options: Method.Options, protected ux: UX) {
    super(options, ux);
    this.s3 = new AmazonS3(options.cli, options.channel, ux);
  }

  public async darwin(): Promise<Results> {
    const pkg = `${this.options.cli}.pkg`;
    const url = `${this.s3.directory}/${pkg}`;
    const location = path.join(this.options.directory, pkg);
    await this.s3.download(url, location);
    const result = exec(`sudo installer -pkg ${location} -target /`, { silent: true });

    if (result.code === 0) {
      const success = this.nixTest();
      this.logResult(success);
      return { [url]: success };
    } else {
      this.logResult(false);
      return { [url]: false };
    }
  }

  public async win32(): Promise<Results> {
    const executables = [`${this.options.cli}-x64.exe`, `${this.options.cli}-x86.exe`];
    const results: Results = {};
    for (const exe of executables) {
      const url = `${this.s3.directory}/${exe}`;
      const location = path.join(this.options.directory, exe);
      await this.s3.download(url, location);
      const installLocation = `C:\\install-test\\${this.options.cli}\\${exe.includes('x86') ? 'x86' : 'x64'}`;
      const cmd = `Start-Process -Wait -FilePath "${location}" -ArgumentList "/S", "/D=${installLocation}" -PassThru`;
      this.ux.log(`Installing ${chalk.cyan(exe)}...`);
      const result = exec(cmd, { silent: false, shell: 'powershell.exe' });

      if (result.code === 0) {
        const success = this.win32Test(installLocation);
        this.logResult(success);
        results[url] = success;
      } else {
        this.logResult(false);
        results[url] = false;
      }
    }

    return results;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async linux(): Promise<Results> {
    throw new Error('Installers not supported for linux.');
  }

  protected async ping(): Promise<ServiceAvailability> {
    return this.s3.ping();
  }

  private win32Test(installLocation: string): boolean {
    const binaryPath = path.join(installLocation, 'bin', `${this.options.cli}.cmd`);
    this.ux.log(`Testing ${chalk.cyan(binaryPath)}`);
    const execOptions = { silent: true, shell: 'powershell.exe' };
    const result = exec(`& "${binaryPath}" --version`, execOptions);
    const version = (result.stdout ?? result.stderr).replace(/\n*$/, '');
    this.ux.log(chalk.dim(version));
    if (result.code === 0) {
      return binaryPath.includes('x86') ? version.includes('win32-x86') : version.includes('win32-x64');
    } else {
      return false;
    }
  }

  private nixTest(): boolean {
    const binaryPath = `/usr/local/bin/${this.options.cli}`;
    this.ux.log(`Testing ${chalk.cyan(binaryPath)}`);
    const result = exec(`${binaryPath} --version`, { silent: true });
    this.ux.log(chalk.dim((result.stdout ?? result.stderr).replace(/\n*$/, '')));
    return result.code === 0;
  }
}

export default class Test extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    cli: flags.string({
      description: messages.getMessage('cliFlag'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    method: flags.string({
      description: messages.getMessage('methodFlag'),
      options: Object.values(Method.Type),
      char: 'm',
      required: true,
    }),
    channel: flags.string({
      description: messages.getMessage('channelFlag'),
      options: Object.values(Channel),
      default: 'stable',
    }),
  };

  public async run(): Promise<Results> {
    const cli = ensure<CLI>(this.flags.cli);
    const method = ensure<Method.Type>(this.flags.method);
    const channel = ensure<Channel>(this.flags.channel);
    const directory = await this.makeWorkingDir(cli, channel, method);
    this.ux.log(`Working Directory: ${directory}`);
    this.ux.log();
    let results: Results = {};
    switch (method) {
      case 'tarball': {
        const tarball = new Tarball({ cli, channel, directory, method }, this.ux);
        results = await tarball.execute();
        break;
      }
      case 'npm': {
        const npm = new Npm({ cli, channel, directory, method }, this.ux);
        results = await npm.execute();
        break;
      }
      case 'installer': {
        const installer = new Installer({ cli, channel, directory, method }, this.ux);
        results = await installer.execute();
        break;
      }
      default:
        break;
    }

    const hasFailures = Object.values(results).some((r) => !r);
    if (hasFailures) process.exitCode = 1;
    return results;
  }

  private async makeWorkingDir(cli: CLI, channel: Channel, method: Method.Type): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), 'cli-install-test', cli, channel, method);
    // ensure that we are starting with a clean directory
    try {
      await fs.remove(tmpDir);
    } catch {
      // error means that folder doesn't exist which is okay
    }
    await fs.mkdirp(tmpDir, { recursive: true });
    return tmpDir;
  }
}
