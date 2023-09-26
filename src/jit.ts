/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-await-in-loop */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec as execSync, ExecException } from 'child_process';
import { Ux } from '@salesforce/sf-plugins-core';
import * as chalk from 'chalk';
import { SfError } from '@salesforce/core';
import { parseJson } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import stripAnsi = require('strip-ansi');
import { PackageJson } from './package';

const exec = promisify(execSync);

type Options = {
  jsonEnabled: boolean;
  jitPlugin?: string[];
  executable: string;
  manifestPath?: string;
};

export async function testJITInstall(options: Options): Promise<void> {
  const { jsonEnabled, jitPlugin, executable } = options;
  const ux = new Ux({ jsonEnabled });

  const tmpDir = path.join(os.tmpdir(), 'sf-jit-test');
  // Clear tmp dir before test to ensure that we're starting from a clean slate
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.mkdir(tmpDir, { recursive: true });

  ux.styledHeader('Testing JIT installation');

  const fileData = await fs.promises.readFile('package.json', 'utf8');
  const packageJson = parseJson(fileData) as PackageJson;
  const jitPlugins = jitPlugin ?? Object.keys(packageJson.oclif?.jitPlugins ?? {});
  if (jitPlugins.length === 0) return;

  let manifestData;
  try {
    manifestData = options.manifestPath
      ? await fs.promises.readFile(options.manifestPath, 'utf8')
      : await fs.promises.readFile('oclif.manifest.json', 'utf8');
  } catch {
    ux.log('No oclif.manifest.json found. Generating one now.');
    await exec('yarn oclif manifest');
    manifestData = await fs.promises.readFile('oclif.manifest.json', 'utf8');
  }

  const manifest = parseJson(manifestData) as Interfaces.Manifest;

  const commands = Object.values(manifest.commands);

  const help = async (command: string): Promise<boolean> => {
    try {
      await exec(`${executable} ${command} --help`);
      return true;
    } catch (e) {
      return false;
    }
  };

  const verifyInstall = async (plugin: string, dataDir: string): Promise<boolean> => {
    const userPjsonRaw = await fs.promises.readFile(path.join(dataDir, 'package.json'), 'utf-8');

    const userPjson = parseJson(userPjsonRaw) as PackageJson;
    return Boolean(userPjson.dependencies?.[plugin]);
  };

  const passedInstalls: string[] = [];
  const failedInstalls: string[] = [];

  await Promise.all(
    jitPlugins.map(async (plugin) => {
      ux.log(`Testing JIT install for ${plugin}`);
      const dataDir = path.join(tmpDir, plugin, 'data');
      const cacheDir = path.join(tmpDir, plugin, 'cache');
      const configDir = path.join(tmpDir, plugin, 'config');

      await fs.promises.mkdir(dataDir, { recursive: true });
      await fs.promises.mkdir(cacheDir, { recursive: true });
      await fs.promises.mkdir(configDir, { recursive: true });

      let resultStdout = '';
      let resultStderr = '';

      try {
        const firstCommand = commands.find((c) => c.pluginName === plugin);
        if (!firstCommand) {
          throw new SfError(`Unable to find command for ${plugin}`);
        }

        // Test that --help works on JIT commands
        const helpResult = await help(firstCommand.id);
        ux.log(`${executable} ${firstCommand.id} --help ${helpResult ? chalk.green('PASSED') : chalk.red('FAILED')}`);

        ux.log(`${executable} ${firstCommand.id}`);
        // Test that executing the command will trigger JIT install
        // This will likely always fail because we're not providing all the required flags or it depends on some other setup.
        // However, this is okay because all we need to verify is that running the command will trigger the JIT install
        const { stdout, stderr } = await exec(`${executable} ${firstCommand.id}`, {
          env: {
            ...process.env,
            SF_DATA_DIR: dataDir,
            SF_CACHE_DIR: cacheDir,
            SF_CONFIG_DIR: configDir,
          },
        });
        resultStdout = stripAnsi(stdout);
        resultStderr = stripAnsi(stderr);
      } catch (e) {
        const err = e as ExecException;
        // @ts-expect-error ExecException type doesn't have a stdout or stderr property
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        resultStdout = stripAnsi(err.stdout);
        // @ts-expect-error ExecException type doesn't have a stdout or stderr property
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        resultStderr = stripAnsi(err.stderr);
      } finally {
        const result = await verifyInstall(plugin, dataDir);
        if (result) {
          ux.log(`✅ ${chalk.green(`Verified installation of ${plugin}\n`)}`);
          passedInstalls.push(plugin);
        } else {
          ux.log(`❌ ${chalk.red(`Failed installation of ${plugin}\n`)}`);
          failedInstalls.push(plugin);
          ux.log(`stdout:\n${resultStdout}`);
          ux.log(`stderr:\n${resultStderr}`);
        }
      }
    })
  );

  ux.styledHeader('JIT Installation Results');
  ux.log(`Passed (${passedInstalls.length})`);
  passedInstalls.forEach((msg) => ux.log(`• ${msg}`));
  if (failedInstalls.length) {
    ux.log();
    ux.log(`Failed (${failedInstalls.length})`);
    failedInstalls.forEach((msg) => ux.log(`• ${msg}`));
    throw new SfError('Failed JIT installation');
  }
}
