/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { type as osType } from 'os';
import * as path from 'path';

import * as fs from 'fs';
import npmRunPath from 'npm-run-path';
import * as shelljs from 'shelljs';

import { SfdxError, Logger } from '@salesforce/core';
import { ShellString } from 'shelljs';
import { AsyncCreatable } from '@salesforce/kit';

export type PluginShowResults = {
  versions: string[];
  'dist-tags': {
    [name: string]: string;
  };
  sfdx?: {
    publicKeyUrl: string;
    signatureUrl: string;
  };
  dist?: {
    [name: string]: string;
  };
};

type PluginCommandOptions = shelljs.ExecOptions & {
  npmName: string;
  commandBin: string;
  cliRoot: string;
};

type PluginRunOptions = shelljs.ExecOptions & {
  command: string;
  parameters: string[];
};

type PluginCommandResult = PluginShowResults & {
  [name: string]: string;
};

type PluginPackage = {
  bin: {
    [name: string]: string;
  };
};

export class PluginCommand extends AsyncCreatable<PluginCommandOptions> {
  private pkgPath: string;
  private nodeExecutable: string;
  private bin: string;
  private pkg: PluginPackage;
  private logger: Logger;

  public constructor(private options: PluginCommandOptions) {
    super(options);
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.pkgPath = require.resolve(path.join(this.options.npmName, 'package.json'), { paths: [this.options.cliRoot] });
    this.pkg = JSON.parse(fs.readFileSync(this.pkgPath, 'utf8')) as PluginPackage;
    this.nodeExecutable = this.findNode(this.options.cliRoot);
    this.bin = this.getBin();
  }
  public runPluginCmd(options: PluginRunOptions): PluginCommandResult | ShellString {
    const command = `"${this.nodeExecutable}" "${this.bin}" ${options.command} ${options.parameters
      .map((p) => `"${p}"`)
      .join(' ')}`;
    this.logger.debug(`Running plugin comand ${command}`);
    const results = shelljs.exec(command, {
      ...options,
      silent: true,
      fatal: true,
      async: false,
      env: npmRunPath.env({ env: process.env }),
    });
    if (results.code !== 0) {
      this.logger.debug(`Plugin command ${command} failed`, results.stderr);
      throw new SfdxError(results.stderr, 'ShellExecError');
    }
    this.logger.debug(`Plugin command ${command} succeeded`, results);
    try {
      if (options.parameters?.includes('--json')) {
        return JSON.parse(results.stdout) as PluginCommandResult;
      } else {
        return results;
      }
    } catch (error) {
      const sfdxError = new SfdxError(error, 'JsonParseError');
      this.logger.debug(`Plugin command ${command} threw eception`, sfdxError);
      throw sfdxError;
    }
  }

  private packagePath(): string {
    return this.pkgPath;
  }

  /**
   * Returns the path to the defined bin file in this package's node_modules
   *
   * @private
   */
  private getBin(): string {
    const pkgPath = this.packagePath();
    const prjPath = pkgPath.substring(0, pkgPath.lastIndexOf(path.sep));
    if (!this.pkg.bin[this.options.commandBin]) {
      const sfdxError = new SfdxError(
        `Could not locate commandBin ${this.options.commandBin} in package at path ${pkgPath}`
      );
      this.logger.debug(sfdxError);
      throw sfdxError;
    }
    return path.join(prjPath, this.pkg.bin[this.options.commandBin]);
  }

  /**
   * Locate node executable and return its absolute path
   * First it tries to locate the node executable on the root path passed in
   * If not found then tries to use whatever 'node' resolves to on the user's PATH
   * If found return absolute path to the executable
   * If the node executable cannot be found, an error is thrown
   *
   * @private
   */
  private findNode(root: string = undefined): string {
    const isExecutable = (filepath: string): boolean => {
      if (osType() === 'Windows_NT') return filepath.endsWith('node.exe');

      try {
        if (filepath.endsWith('node')) {
          // This checks if the filepath is executable on Mac or Linux, if it is not it errors.
          fs.accessSync(filepath, fs.constants.X_OK);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    if (root) {
      const sfdxBinDirs = this.findSfdxBinDirs(root);
      if (sfdxBinDirs.length > 0) {
        // Find the node executable
        const node = shelljs.find(sfdxBinDirs).filter((file) => isExecutable(file))[0];
        if (node) {
          return fs.realpathSync(node);
        }
      }
    }

    // Check to see if node is installed
    const nodeShellString: shelljs.ShellString = shelljs.which('node');
    if (nodeShellString?.code === 0 && nodeShellString?.stdout) return nodeShellString.stdout;

    throw new SfdxError('Cannot locate node executable.', 'CannotFindNodeExecutable');
  }

  /**
   * Finds the bin directory in the sfdx installation root path
   *
   * @param sfdxPath
   * @private
   */
  private findSfdxBinDirs(sfdxPath: string): string[] {
    return sfdxPath
      ? [path.join(sfdxPath, 'bin'), path.join(sfdxPath, 'client', 'bin')].filter((p) => fs.existsSync(p))
      : [];
  }
}
