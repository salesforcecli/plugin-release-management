/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fg from 'fast-glob';
import { exec } from 'shelljs';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { ensure, ensureNumber, get } from '@salesforce/ts-types';
import { red, yellow, green } from 'chalk';
import { parseJson } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { CLI } from '../../../types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'cli.tarballs.verify', [
  'description',
  'examples',
  'cli',
  'windowsUsernameBuffer',
]);

const PASSED = green.bold('PASSED');
const FAILED = red.bold('FAILED');

/**
 * Checks if a file path exists
 *
 * @param filePath the file path to check the existence of
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * The functionality of this command is taken entirely from https://github.com/salesforcecli/sfdx-cli/blob/v7.109.0/scripts/verify-tarballs
 */
export default class Verify extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flags = {
    cli: Flags.enum({
      summary: messages.getMessage('cli'),
      options: Object.values(CLI),
      default: 'sfdx',
      char: 'c',
    }),
    ['windows-username-buffer']: Flags.integer({
      summary: messages.getMessage('windowsUsernameBuffer'),
      default: 41,
      char: 'w',
    }),
  };

  private baseDir!: string;
  private step = 1;
  private totalSteps = 1;

  private flags: Interfaces.InferredFlags<typeof Verify.flags>;

  public async run(): Promise<void> {
    const { flags } = await this.parse(Verify);
    this.flags = flags;
    const cli = ensure<CLI>(this.flags.cli as CLI);
    this.baseDir = path.join('tmp', cli);
    const cliRunLists: Record<CLI, Array<() => Promise<void>>> = {
      [CLI.SFDX]: [
        this.ensureNoWebDriverIO.bind(this),
        this.ensureNoHerokuCliUtilNyc.bind(this),
        this.ensureWindowsPathLengths.bind(this),
        this.ensureApexNode.bind(this),
        this.ensurePluginGenerateTestTemplates.bind(this),
        this.ensureTemplatesCommands.bind(this),
        this.ensureNoDistTestsOrMaps.bind(this),
        this.ensureNoUnexpectedFiles.bind(this),
        this.ensureSfIsIncluded.bind(this),
      ],
      [CLI.SF]: [
        this.ensureNoDistTestsOrMaps.bind(this),
        this.ensureNoUnexpectedFiles.bind(this),
        this.ensureWindowsPathLengths.bind(this),
        this.ensureMdMessagesExist.bind(this),
      ],
    };

    this.totalSteps = cliRunLists[cli].length;
    for (const test of cliRunLists[cli]) {
      // eslint-disable-next-line no-await-in-loop
      await test();
    }
  }

  public async execute(msg: string, validate: () => Promise<boolean>): Promise<boolean> {
    this.spinner.start(`[${this.step}/${this.totalSteps}] ${msg}`);
    if (!(await validate())) {
      this.spinner.stop(FAILED);
      return false;
    }
    this.step += 1;
    this.spinner.stop(PASSED);
    return true;
  }

  public async ensureNoWebDriverIO(): Promise<void> {
    const webDriverIo = path.join(this.baseDir, 'node_modules', 'webdriverio', 'test');
    const validate = async (): Promise<boolean> => !(await fileExists(webDriverIo));
    const passed = await this.execute('Ensure webdriverio does not exist', validate);
    if (!passed) {
      throw new SfError(`${webDriverIo} is present. Was the clean not aggressive enough?`);
    }
  }

  public async ensureNoHerokuCliUtilNyc(): Promise<void> {
    const herokuCliUtil = path.join(
      this.baseDir,
      'node_modules',
      '@salesforce',
      'plugin-templates',
      'node_modules',
      'salesforce-alm',
      'node_modules',
      'heroku-cli-util',
      '.nyc_output'
    );
    const validate = async (): Promise<boolean> => !(await fileExists(herokuCliUtil));
    const passed = await this.execute('Ensure heroku-cli-util/.nyc_output does not exist', validate);
    if (!passed) {
      throw new SfError(`${herokuCliUtil} is present. Was the clean not aggressive enough?`);
    }
  }

  /**
   * Ensure that the path lengths in the build tree are as windows safe as possible.
   *
   * The check fails if the path lengths DO NOT allow for a username longer than the --windows-username-buffer
   *
   * Warnings will be emitted for any path that does not allow for a username longer than 48 characters
   */
  public async ensureWindowsPathLengths(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const maxWindowsPath = 259;
      const cli = ensure<CLI>(this.flags.cli as CLI);

      const supportedUsernameLength = ensureNumber(this.flags['windows-username-buffer']);
      const fakeSupportedUsername = 'u'.repeat(supportedUsernameLength);
      const supportedBaseWindowsPath = `C:\\Users\\${fakeSupportedUsername}\\AppData\\Local\\${cli}\\tmp\\${cli}-cli-v1.xxx.yyy-abcdef-windows-x64\\`;

      const maxUsernameLength = 64;
      const fakeMaxUsername = 'u'.repeat(maxUsernameLength);
      const maxBaseWindowsPath = `C:\\Users\\${fakeMaxUsername}\\AppData\\Local\\${cli}\\tmp\\${cli}-cli-v1.xxx.yyy-abcdef-windows-x64\\`;

      const supportedWindowsPathLength = maxWindowsPath - supportedBaseWindowsPath.length;
      const maxWindowsPathLength = maxWindowsPath - maxBaseWindowsPath.length;

      this.log('Windows Path Length Test:');
      this.log(`  - max windows path length: ${maxWindowsPath}`);
      this.log('  ---- Upper Limit ----');
      this.log(`  - ${cli} max username length: ${maxUsernameLength}`);
      this.log(`  - ${cli} max base path length: ${maxBaseWindowsPath.length}`);
      this.log(`  - ${cli} max allowable path length: ${maxWindowsPathLength}`);
      this.log('  ---- Supported Limit ----');
      this.log(`  - ${cli} supported username length: ${supportedUsernameLength}`);
      this.log(`  - ${cli} supported base path length: ${supportedBaseWindowsPath.length}`);
      this.log(`  - ${cli} supported allowable path length: ${supportedWindowsPathLength}`);

      const paths = (await fg(`${this.baseDir}/node_modules/**/*`)).map((p) =>
        p.replace(`${this.baseDir}${path.sep}`, '')
      );
      const warnPaths = paths
        .filter((p) => p.length >= maxWindowsPathLength && p.length < supportedWindowsPathLength)
        .sort();
      const errorPaths = paths.filter((p) => p.length >= supportedWindowsPathLength).sort();
      if (warnPaths.length) {
        this.log(
          `${yellow.bold(
            'WARNING:'
          )} Some paths could result in errors for Windows users with usernames that are ${maxUsernameLength} characters!`
        );
        warnPaths.forEach((p) => this.log(`${p.length} - ${p}`));
      }
      if (errorPaths.length) {
        this.log(`${red.bold('ERROR:')} Unacceptably long paths detected in base build!`);
        errorPaths.forEach((p) => this.log(`${p.length} - ${p}`));
        return false;
      }

      return true;
    };
    const passed = await this.execute('Ensure windows path lengths', validate);
    if (!passed) {
      throw new SfError('Unacceptably long paths detected in base build!');
    }
  }

  public async ensureApexNode(): Promise<void> {
    const apexNodePath = path.join(this.baseDir, 'node_modules', '@salesforce', 'apex-node', 'lib', 'src', 'tests');
    const validate = async (): Promise<boolean> => fileExists(apexNodePath);
    const passed = await this.execute('Ensure apex-node exists', validate);
    if (!passed) {
      throw new SfError(`${apexNodePath} is missing!. Was the clean too aggressive?`);
    }
  }

  public async ensurePluginGenerateTestTemplates(): Promise<void> {
    const pluginGeneratorTestPath = path.join(
      this.baseDir,
      'node_modules',
      '@salesforce',
      'plugin-generator',
      'templates',
      'sfdxPlugin',
      'test'
    );
    const validate = async (): Promise<boolean> => fileExists(pluginGeneratorTestPath);
    const passed = await this.execute('Ensure plugin generator test template exists', validate);
    if (!passed) {
      throw new SfError(`${pluginGeneratorTestPath} is missing!. Was the clean too aggressive?`);
    }
  }

  public async ensureTemplatesCommands(): Promise<void> {
    const templatesPath = path.join(this.baseDir, 'node_modules', '@salesforce', 'plugin-templates');
    const validate = async (): Promise<boolean> => fileExists(templatesPath);
    const passed = await this.execute('Ensure templates commands exist', validate);
    if (!passed) {
      throw new SfError(`${templatesPath} is missing!. Was the doc clean too aggressive?`);
    }
  }

  public async ensureNoDistTestsOrMaps(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const files = await fg([`${this.baseDir}/dist/*.test.js`, `${this.baseDir}/dist/*.js.map`]);
      if (files.length) {
        this.log(red.bold('Found the following in dist:'));
        for (const file of files) this.log(file);
        return false;
      }
      return true;
    };
    const passed = await this.execute('Ensure no tests or maps in dist', validate);
    if (!passed) {
      throw new SfError(`Found .test.js and/or .js.map files in ${path.join(this.baseDir, 'dist')}`);
    }
  }

  public async ensureNoUnexpectedFiles(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const expectedFileGlobs = [
        `${this.baseDir}/package.json`,
        `${this.baseDir}/LICENSE.txt`,
        `${this.baseDir}/README.md`,
        `${this.baseDir}/CHANGELOG.md`,
        `${this.baseDir}/yarn.lock`,
        `${this.baseDir}/oclif.manifest.json`,
        `${this.baseDir}/bin/*`,
        `${this.baseDir}/dist/**/*.js`,
        `${this.baseDir}/dist/builtins/package.json`,
        `${this.baseDir}/scripts/*`,
        `${this.baseDir}/sf/**/*`,
      ];
      const expectedFiles = await fg(expectedFileGlobs);
      const allFiles = await fg([`${this.baseDir}/**/*`, `!${this.baseDir}/node_modules/**/*`]);
      const unexpectedFiles = allFiles.filter((f) => !expectedFiles.includes(f));
      if (unexpectedFiles.length) {
        this.log(red.bold('Found unexpected files in base build dir:'));
        for (const file of unexpectedFiles) this.log(file);
        return false;
      }
      return true;
    };
    const passed = await this.execute('Ensure no unexpected files', validate);
    if (!passed) {
      throw new SfError('Unexpected file found in base build dir!');
    }
  }

  public async ensureMdMessagesExist(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const fileData = await fs.readFile(path.join(this.baseDir, 'package.json'), 'utf8');
      const packageJson = parseJson(fileData, path.join(this.baseDir, 'package.json'), false);
      const plugins = get(packageJson, 'oclif.plugins', []) as string[];
      const globs = plugins.map((p) => `${this.baseDir}/node_modules/${p}/messages/*.md`);
      const files = await fg(globs);
      return Boolean(files.length);
    };
    const passed = await this.execute('Ensure .md messages exist', validate);
    if (!passed) {
      throw new SfError('Found no .md message files. Was the clean too aggressive?');
    }
  }

  public async ensureSfIsIncluded(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const sfBin = path.join(this.baseDir, 'bin', 'sf');
      const sfBinExists = await fileExists(sfBin);
      const sfCmd = path.join(this.baseDir, 'bin', 'sf.cmd');
      const sfCmdExists = await fileExists(sfCmd);
      const version = exec(`${sfBin} --version`, { silent: false });
      const help = exec(`${sfBin} --help`, { silent: false });
      return sfBinExists && sfCmdExists && version.code === 0 && help.code === 0;
    };
    const passed = await this.execute('Ensure sf is included\n', validate);
    if (!passed) {
      throw new SfError('sf was not included! Did include-sf.js succeed?');
    }
  }
}
