/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as fg from 'fast-glob';
import { pwd, rm } from 'shelljs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { red } from 'chalk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.tarballs.prepare');

/**
 * The functionality of this command is taken entirely from https://github.com/salesforcecli/sfdx-cli/blob/v7.109.0/scripts/clean-for-tarballs
 */
export default class Verify extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    dryrun: flags.boolean({
      description: messages.getMessage('dryrun'),
      default: false,
      char: 'd',
    }),
    types: flags.boolean({
      description: messages.getMessage('types'),
      default: false,
      char: 't',
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verbose'),
    }),
  };

  public async run(): Promise<void> {
    const workingDir = pwd().stdout;
    const baseDirGlob = `${workingDir}/node_modules`;

    // Remove JSforceTestSuite from dist
    const jsForceTestSuite = await this.find(`${baseDirGlob}/JSforceTestSuite`, { onlyDirectories: true });
    this.remove(jsForceTestSuite, 'JSforceTestSuite files');

    // Module readmes and other markdown docs not found in template directories
    const markdownFiles = await this.find(`${baseDirGlob}/**/*.md`, { excludeDirectory: 'templates' });
    this.remove(markdownFiles, '.md files');

    // Module .gitignore not found in template directories
    const gitignore = await this.find(`${baseDirGlob}/**/.gitignore`, { excludeDirectory: 'templates' });
    this.remove(gitignore, '.gitignore files');

    // Module .gitattributes not found in template directories
    const gitattributes = await this.find(`${baseDirGlob}/**/.gitattributes`, { excludeDirectory: 'templates' });
    this.remove(gitattributes, '.gitattributes files');

    // Module .eslintrc not found in template directories
    const eslintrc = await this.find(`${baseDirGlob}/**/.eslintrc`, { excludeDirectory: 'templates' });
    this.remove(eslintrc, '.eslintrc files');

    // Module appveyor.yml not found in template directories
    const appveyor = await this.find(`${baseDirGlob}/**/appveyor.yml`, { excludeDirectory: 'templates' });
    this.remove(appveyor, 'appveyor.yml files');

    // Module circle.yml not found in template directories
    const circle = await this.find(`${baseDirGlob}/**/circle.yml`, { excludeDirectory: 'templates' });
    this.remove(circle, 'circle.yml files');

    // Module test dirs, except in salesforce-alm, which includes production source code in such a dir
    const allowedTestDirs = [
      'command',
      'commands',
      'lib',
      'dist',
      'salesforce-alm',
      '@salesforce/plugin-templates',
      '@salesforce/plugin-generator',
    ];
    const testDirs = (await this.find(`${baseDirGlob}/**/test`, { onlyDirectories: true })).filter((f) => {
      return !allowedTestDirs.some((d) => f.includes(d));
    });
    this.remove(testDirs, 'test directories');

    // JS map files, except the ill-named `lodash.map` (it's a directory and we'll also filter out matches if found for good measure)
    const maps = (await this.find(`${baseDirGlob}/**/*.map`)).filter((f) => !f.includes('lodash.map'));
    this.remove(maps, '*.map files');

    // In case yarn autoclean is disabled, delete some known windows file path length offenders
    const nycOutput = await this.find(`${baseDirGlob}/**/.nyc_output`);
    this.remove(nycOutput, '.nyc_output files');

    // Large files shipped with jsforce
    const jsforceBuild = await this.find(`${baseDirGlob}/jsforce/build`, { onlyDirectories: true });
    this.remove(jsforceBuild, 'jsforce/build directory');

    // This breaks compilation. We need to probably do this right before the pack, but then this will
    // break compilation the next time compile is ran without doing a yarn install --force
    // We don't need types in the production code
    if (this.flags.types) {
      const types = await this.find(`${baseDirGlob}/**/*.d.ts`);
      this.remove(types, '*.d.ts files');
    }
  }

  private async find(globPattern: string, options: fg.Options & { excludeDirectory?: string } = {}): Promise<string[]> {
    const patterns = [globPattern];
    if (options.excludeDirectory) {
      const parts = globPattern.split('/');
      const lastPart = parts.pop();
      parts.push(options.excludeDirectory, '**', lastPart);
      const exclusionPattern = `!${parts.join('/')}`;
      patterns.push(exclusionPattern);
    }
    if (options?.excludeDirectory) delete options.excludeDirectory;
    return fg(patterns, options);
  }

  private remove(files: string[], type: string): void {
    if (!files.length) return;
    const msg = this.flags.dryrun
      ? `${red.bold('[DRYRUN] Removing:')} ${files.length} ${type}`
      : `${red.bold('Removing:')} ${files.length} ${type}`;
    this.log(msg);

    if (this.flags.verbose) {
      files.forEach((f) => this.log(`  ${f}`));
    }

    if (!this.flags.dryrun) {
      files.forEach((f) => rm('-rf', f));
    }
  }
}
