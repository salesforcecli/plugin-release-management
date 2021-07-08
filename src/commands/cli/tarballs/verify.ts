/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as path from 'path';
import * as fg from 'fast-glob';
import { exec } from 'shelljs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs, Messages, SfdxError } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import { red, yellow, green } from 'chalk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.verify');

export enum CLI {
  SF = 'sf',
  SFDX = 'sfdx',
}

const PASSED = green.bold('PASSED');
const FAILED = red.bold('FAILED');

/**
 * The functionality of this command is taken entirely from https://github.com/salesforcecli/sfdx-cli/blob/v7.109.0/scripts/verify-tarballs
 */
export default class Verify extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    cli: flags.enum({
      description: messages.getMessage('cli'),
      options: Object.values(CLI),
      default: 'sfdx',
      char: 'c',
    }),
  };

  private baseDir!: string;
  private step = 1;
  private totalSteps = 1;

  public async run(): Promise<void> {
    const cli = ensure<CLI>(this.flags.cli);
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
        this.ensureNoUnexpectedfiles.bind(this),
        // TODO: add this once https://github.com/salesforcecli/sfdx-cli/pull/195 is merged
        // this.ensureSfIsIncluded.bind(this),
      ],
      [CLI.SF]: [
        this.ensureNoDistTestsOrMaps.bind(this),
        this.ensureNoUnexpectedfiles.bind(this),
        // TODO: add this back before R1
        // this.ensureWindowsPathLengths.bind(this),
      ],
    };

    this.totalSteps = cliRunLists[cli].length;
    for (const test of cliRunLists[cli]) {
      await test();
    }
  }

  public async execute(msg: string, validate: () => Promise<boolean>): Promise<boolean> {
    this.ux.cli.action.start(`[${this.step}/${this.totalSteps}] ${msg}`);
    if (!(await validate())) {
      this.ux.cli.action.stop(FAILED);
      return false;
    }
    this.step += 1;
    this.ux.cli.action.stop(PASSED);
    return true;
  }

  public async ensureNoWebDriverIO(): Promise<void> {
    const webDriverIo = path.join(this.baseDir, 'node_modules', 'webdriverio', 'test');
    const validate = async (): Promise<boolean> => {
      return !(await fs.fileExists(webDriverIo));
    };
    const passed = await this.execute('Ensure webdriverio does not exist', validate);
    if (!passed) {
      throw new SfdxError(`${webDriverIo} is present. Was the clean not aggressive enough?`);
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
    const validate = async (): Promise<boolean> => {
      return !(await fs.fileExists(herokuCliUtil));
    };
    const passed = await this.execute('Ensure heroku-cli-util/.nyc_output does not exist', validate);
    if (!passed) {
      throw new SfdxError(`${herokuCliUtil} is present. Was the clean not aggressive enough?`);
    }
  }

  /**
   * Make sure cleaning was not too aggressive and that path lengths in the build tree are as windows-safe as they can be
   *
   * Check for potentially overflowing windows paths:
   * - assume a max practical windows username length of 64 characters (https://technet.microsoft.com/it-it/library/bb726984(en-us).aspx)
   * - add characters to account for the root sfdx client tmp untar path for a total of 135
   * e.g. C:\Users\<username>\AppData\Local\sfdx\tmp\sfdx-cli-v7.xx.yy-abcdef-windows-x64\
   * - subtract those 135 characters from the max windows path length of 259 to yield the allowable length of 124 path characters
   * - considering that we currently have some dependencies in the built output that exceed 124 characters (up to 139 in salesforce-lightning-cli)
   * we will consider the maximum path length of 139, plus 5 as a buffer, as the hard upper limit to our allowable path length;
   * this leaves us a relatively comfortable maximum windows username length of 48 characters with a hard maximum path length of 144 characters
   * - then scan the cleaned build output directory for paths exceding this threshold, and exit with an error if detected
   */
  public async ensureWindowsPathLengths(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const warningLength = 124;
      const maxLength = 146;
      const paths = (await fg(`${this.baseDir}/node_modules/**/*`)).map((p) =>
        p.replace(`${this.baseDir}${path.sep}`, '')
      );
      const warnPaths = paths.filter((p) => p.length >= warningLength && p.length < maxLength).sort();
      const errorPaths = paths.filter((p) => p.length >= maxLength).sort();
      if (warnPaths.length) {
        this.log(
          `${yellow.bold(
            'WARNING:'
          )} Some paths could result in update errors for Windows users with usernames greater than 48 characters!`
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
      throw new SfdxError('Unacceptably long paths detected in base build!');
    }
  }

  public async ensureApexNode(): Promise<void> {
    const apexNodePath = path.join(this.baseDir, 'node_modules', '@salesforce', 'apex-node', 'lib', 'src', 'tests');
    const validate = async (): Promise<boolean> => fs.fileExists(apexNodePath);
    const passed = await this.execute('Ensure apex-node exists', validate);
    if (!passed) {
      throw new SfdxError(`${apexNodePath} is missing!. Was the clean too aggressive?`);
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
    const validate = async (): Promise<boolean> => fs.fileExists(pluginGeneratorTestPath);
    const passed = await this.execute('Ensure plugin generator test template exists', validate);
    if (!passed) {
      throw new SfdxError(`${pluginGeneratorTestPath} is missing!. Was the clean too aggressive?`);
    }
  }

  public async ensureTemplatesCommands(): Promise<void> {
    const templatesPath = path.join(this.baseDir, 'node_modules', '@salesforce', 'plugin-templates');
    const validate = async (): Promise<boolean> => fs.fileExists(templatesPath);
    const passed = await this.execute('Ensure templates commands exist', validate);
    if (!passed) {
      throw new SfdxError(`${templatesPath} is missing!. Was the doc clean too aggressive?`);
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
      throw new SfdxError(`Found .test.js and/or .js.map files in ${path.join(this.baseDir, 'dist')}`);
    }
  }

  public async ensureNoUnexpectedfiles(): Promise<void> {
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
        `${this.baseDir}/scripts/clean-for-tarballs`,
        `${this.baseDir}/scripts/include-sf.js`,
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
      throw new SfdxError('Unexpected file found in base build dir!');
    }
  }

  public async ensureSfIsIncluded(): Promise<void> {
    const validate = async (): Promise<boolean> => {
      const sfBin = path.join(this.baseDir, 'bin', 'sf');
      const sfBinExists = await fs.fileExists(sfBin);
      const sfCmd = path.join(this.baseDir, 'bin', 'sf.cmd');
      const sfCmdExists = await fs.fileExists(sfCmd);
      const version = exec(`${sfBin} --version`, { silent: false });
      const help = exec(`${sfBin} --help`, { silent: false });
      return sfBinExists && sfCmdExists && version.code === 0 && help.code === 0;
    };
    const passed = await this.execute('Ensure sf is included', validate);
    if (!passed) {
      throw new SfdxError('sf was not included! Did include-sf.js succeed?');
    }
  }
}
