/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { exec as execSync } from 'child_process';
import { promisify } from 'node:util';
import * as chalk from 'chalk';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import { CLI } from '../../../types';

const exec = promisify(execSync);

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.smoke');

export default class SmokeTest extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    cli: Flags.string({
      summary: messages.getMessage('cliFlag'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('verboseFlag'),
    }),
  };

  private verbose: boolean;

  public async run(): Promise<void> {
    const { flags } = await this.parse(SmokeTest);
    this.verbose = flags.verbose;
    const cli = ensure<CLI>(flags.cli as CLI);
    const executables = [path.join('tmp', cli, 'bin', cli)];
    if (cli === CLI.SFDX) {
      executables.push(path.join('tmp', cli, 'bin', CLI.SF));
    }
    await Promise.all(executables.map((executable) => this.smokeTest(executable)));
  }

  private async smokeTest(executable: string): Promise<void> {
    await Promise.all([
      this.execute(executable, '--version'),
      this.execute(executable, '--help'),
      this.execute(executable, 'plugins --core'),
      this.execute(executable, 'plugins:install @salesforce/plugin-alias@latest'),
    ]);
    await this.initializeAllCommands(executable);
  }

  private async initializeAllCommands(executable: string): Promise<void> {
    await Promise.all(
      this.verbose
        ? (await this.getAllCommands(executable)).map((command) => this.execute(executable, `${command} --help`))
        : (await this.getAllCommands(executable)).map((command) => this.nonVerboseCommandExecution(executable, command))
    );
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
      throw new SfError(`Failed: ${command}`);
    }
  }
}
