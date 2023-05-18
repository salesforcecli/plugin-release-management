/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-await-in-loop */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec as execSync, ExecException } from 'child_process';
import { promisify } from 'node:util';
import * as chalk from 'chalk';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { Duration, parseJson, ThrottledPromiseAll } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { CLI } from '../../../types';
import { PackageJson } from '../../../package';

const exec = promisify(execSync);

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.smoke');

export default class SmokeTest extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    cli: Flags.custom<CLI>({
      options: Object.values(CLI),
    })({
      summary: messages.getMessage('cliFlag'),
      char: 'c',
      required: true,
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('verboseFlag'),
    }),
  };

  private flags!: Interfaces.InferredFlags<typeof SmokeTest.flags>;

  public async run(): Promise<void> {
    this.flags = (await this.parse(SmokeTest)).flags;
    const executables = [path.join('tmp', this.flags.cli, 'bin', this.flags.cli)];
    if (this.flags.cli === CLI.SFDX) {
      executables.push(path.join('tmp', this.flags.cli, 'bin', CLI.SF));
    }
    await Promise.all(executables.map((executable) => this.smokeTest(executable)));
  }

  private async smokeTest(executable: string): Promise<void> {
    await Promise.all([
      this.execute(executable, '--version'),
      this.execute(executable, '--help'),
      this.execute(executable, 'plugins --core'),
      this.testInstall(executable, '@salesforce/plugin-alias', 'latest'),
    ]);

    // Only run JIT tests for the main executable
    if (this.flags.cli === CLI.SFDX && !executable.endsWith('sf')) {
      await this.testJITInstall(executable);
    }
    await this.initializeAllCommands(executable);
  }

  private async testJITInstall(executable: string): Promise<void> {
    this.styledHeader('Testing JIT installation');
    const fileData = await fs.promises.readFile('package.json', 'utf8');
    const packageJson = parseJson(fileData) as PackageJson;
    const jitPlugins = Object.keys(packageJson.oclif?.jitPlugins ?? {});
    if (jitPlugins.length === 0) return;

    const manifestData = await fs.promises.readFile(path.join('tmp', this.flags.cli, 'oclif.manifest.json'), 'utf8');
    const manifest = parseJson(manifestData) as Interfaces.Manifest;

    const commands = Object.values(manifest.commands);
    let failed = false;

    const help = async (command: string): Promise<boolean> => {
      try {
        await exec(`${executable} ${command} --help`);
        return true;
      } catch (e) {
        return false;
      }
    };

    // We have to test these serially in order to avoid issues when running plugin installs concurrently.
    for (const plugin of jitPlugins) {
      try {
        this.log(`Testing JIT install for ${plugin}`);
        const firstCommand = commands.find((c) => c.pluginName === plugin);
        if (!firstCommand) {
          throw new SfError(`Unable to find command for ${plugin}`);
        }

        // Test that --help works on JIT commands
        const helpResult = await help(firstCommand.id);
        this.log(`${executable} ${firstCommand.id} --help ${helpResult ? chalk.green('PASSED') : chalk.red('FAILED')}`);

        this.log(`${executable} ${firstCommand.id}`);
        // Test that executing the command will trigger JIT install
        // This will likely always fail because we're not providing all the required flags or it depends on some other setup.
        // However, this is okay because all we need to verify is that running the command will trigger the JIT install
        const { stdout, stderr } = await exec(`${executable} ${firstCommand.id}`, { maxBuffer: 1024 * 1024 * 100 });
        this.log(stdout);
        this.log(stderr);
      } catch (e) {
        const err = e as ExecException;
        // @ts-expect-error ExecException type doesn't have a stdout or stderr property
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.log(err.stdout);
        // @ts-expect-error ExecException type doesn't have a stdout or stderr property
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.log(err.stderr);
      } finally {
        const result = await this.verifyInstall(plugin, executable, true);
        if (result) {
          this.log(`✅ ${chalk.green(`Verified installation of ${plugin}\n`)}`);
        } else {
          failed = true;
          this.log(`❌ ${chalk.red(`Failed installation of ${plugin}\n`)}`);
        }
      }
    }

    if (failed) {
      throw new SfError('Failed JIT installation');
    }
  }

  private async testInstall(executable: string, plugin: string, tag?: string): Promise<void> {
    await this.execute(executable, `plugins:install ${plugin}${tag ? `@${tag}` : ''}`);
    await this.verifyInstall(plugin, executable);
  }

  private async verifyInstall(plugin: string, executable: string, silent = false): Promise<boolean> {
    const fileData = await fs.promises.readFile(
      path.join(os.homedir(), '.local', 'share', path.basename(executable), 'package.json'),
      'utf-8'
    );
    const packageJson = parseJson(fileData) as PackageJson;
    if (!packageJson.dependencies?.[plugin]) {
      if (silent) {
        return false;
      } else {
        throw new SfError(`Failed to install ${plugin}\n`);
      }
    } else if (!silent) {
      this.log('✅ ', chalk.green(`Verified installation of ${plugin}\n`));
      return true;
    }

    return true;
  }

  private async initializeAllCommands(executable: string): Promise<void> {
    this.styledHeader(`Initializing help for all ${this.flags.cli} commands`);
    // Ran into memory issues when running all commands at once. Now we run them in batches of 10.
    const throttledPromise = new ThrottledPromiseAll<string, string | void>({
      concurrency: 10,
      timeout: Duration.minutes(10),
    });

    const allCommands = await this.getAllCommands(executable);

    const executePromise = async (command: string): Promise<string | void> =>
      this.flags.verbose
        ? this.execute(executable, `${command} --help`)
        : this.nonVerboseCommandExecution(executable, command);

    throttledPromise.add(allCommands, executePromise);

    await throttledPromise.all();
  }

  private async getAllCommands(executable: string): Promise<string[]> {
    const commandsJson = JSON.parse(await this.execute(executable, 'commands --json', true)) as Array<{ id: string }>;
    return commandsJson.map((c) => c.id);
  }

  private async nonVerboseCommandExecution(executable: string, command: string): Promise<void> {
    try {
      await this.execute(executable, `${command} --help`, true);
      this.log(`${executable} ${command} --help ${chalk.green('PASSED')}`);
    } catch (err) {
      this.log(`${executable} ${command} --help ${chalk.red('FAILED')}`);
      throw err;
    }
  }

  private async execute(executable: string, args: string, silent = false): Promise<string> {
    const command = `${executable} ${args}`;
    try {
      const { stdout } = await exec(command, { maxBuffer: 1024 * 1024 * 100 });
      if (!silent) {
        this.styledHeader(command);
        this.log(stdout);
      }
      return stdout;
    } catch (e) {
      const err = e as Error;
      throw new SfError(`Failed: ${command}.\n ${err.message}`, 'SMOKE_TEST_FAILURE', [], err);
    }
  }
}
