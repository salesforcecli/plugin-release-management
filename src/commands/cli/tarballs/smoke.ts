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
import { Messages, SfError } from '@salesforce/core';
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
    for (const executable of executables) {
      this.smokeTest(executable);
    }
  }

  private smokeTest(executable: string): void {
    this.execute(executable, '--version');
    this.execute(executable, '--help');
    this.execute(executable, 'plugins --core');
    this.execute(executable, 'plugins:install @salesforce/plugin-alias@latest');
    this.initializeAllCommands(executable);
  }

  private initializeAllCommands(executable: string): void {
    for (const command of this.getAllCommands(executable)) {
      if (this.flags.verbose) {
        this.execute(executable, `${command} --help`);
      } else {
        try {
          this.execute(executable, `${command} --help`, true);
          this.log(`${executable} ${command} --help ${chalk.green('PASSED')}`);
        } catch (err) {
          this.log(`${executable} ${command} --help ${chalk.red('FAILED')}`);
          throw err;
        }
      }
    }
  }

  private getAllCommands(executable: string): string[] {
    const commandsJson = JSON.parse(this.execute(executable, 'commands --json', true)) as Array<{ id: string }>;
    return commandsJson.map((c) => c.id);
  }

  private execute(executable: string, args: string, silent = false): string {
    const command = `${executable} ${args}`;
    const result = exec(command, { silent: true });
    if (result.code === 0) {
      if (!silent) {
        this.ux.styledHeader(command);
        this.log(result.stdout);
      }
      return result.stdout;
    } else {
      throw new SfError(`Failed: ${command}`);
    }
  }
}
