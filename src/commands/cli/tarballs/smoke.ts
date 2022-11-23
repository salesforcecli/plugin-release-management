/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import * as chalk from 'chalk';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import { exec } from 'shelljs';
import { CLI } from '../../../types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.smoke');

export default class SmokeTest extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    cli: flags.string({
      description: messages.getMessage('cliFlag'),
      options: Object.values(CLI),
      char: 'c',
      required: true,
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseFlag'),
    }),
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  public async run(): Promise<void> {
    const cli = ensure<CLI>(this.flags.cli as CLI);
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
      this.flags.verbose
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
      // eslint-disable-next-line no-await-in-loop
      await this.execute(executable, `${command} --help`, true);
      this.log(`${executable} ${command} --help ${chalk.green('PASSED')}`);
    } catch (err) {
      this.log(`${executable} ${command} --help ${chalk.red('FAILED')}`);
      throw err;
    }
  }

  private async execute(executable: string, args: string, silent = false): Promise<string> {
    const command = `${executable} ${args}`;
    return new Promise((resolve, reject) => {
      const result = exec(command, { silent: true });
      if (result.code === 0) {
        if (!silent) {
          this.ux.styledHeader(command);
          this.log(result.stdout);
        }
        resolve(result.stdout);
      } else {
        reject(`Failed: ${command}`);
      }
    });
  }
}
