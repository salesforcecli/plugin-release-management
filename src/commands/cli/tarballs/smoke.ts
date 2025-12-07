/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec as execSync } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { Duration, parseJson, ThrottledPromiseAll } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { PackageJson } from '../../../package.js';
import { testJITInstall } from '../../../jit.js';

const exec = promisify(execSync);

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.smoke');

export default class SmokeTest extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
    }),
  };

  private flags!: Interfaces.InferredFlags<typeof SmokeTest.flags>;

  public async run(): Promise<void> {
    this.flags = (await this.parse(SmokeTest)).flags;
    await this.smokeTest(path.join('tmp', 'sf', 'bin', 'sf'));
  }

  private async smokeTest(executable: string): Promise<void> {
    await Promise.all([
      this.execute(executable, '--version'),
      this.execute(executable, '--help'),
      this.execute(executable, 'plugins --core'),
      this.testInstall(executable, '@salesforce/plugin-settings', 'latest'),
    ]);

    // This tests JIT installs on the generated tarball
    // The cli/jit/install/test.ts command tests against a "local" version (e.g. npm install)
    // If this test continues to be flakey, it could be removed
    await this.testJITInstall(executable);
    await this.initializeAllCommands(executable);
  }

  private async testJITInstall(executable: string): Promise<void> {
    await testJITInstall({
      jsonEnabled: this.jsonEnabled(),
      executable,
      manifestPath: path.join('tmp', 'sf', 'oclif.manifest.json'),
    });
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
    this.styledHeader("Initializing help for all 'sf' commands");
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
