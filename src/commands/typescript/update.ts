/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs, Messages, SfdxError } from '@salesforce/core';
import { exec } from 'shelljs';
import { set } from '@salesforce/kit';
import { asObject, ensureString, get } from '@salesforce/ts-types';
import { NpmPackage, Package } from '../../package';
import { SinglePackageRepo } from '../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'typescript.update');

export default class Update extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    version: flags.string({
      char: 'v',
      description: messages.getMessage('typescriptVersion'),
    }),
    target: flags.string({
      char: 't',
      description: messages.getMessage('esTarget'),
      default: 'ESNext',
    }),
  };

  public async run(): Promise<void> {
    this.validateEsTarget();
    const typescriptPkg = this.retrieveTsPackage();
    this.validateTsVersion(typescriptPkg);

    await this.updateTsVesion(typescriptPkg);
    await this.updateEsTarget();

    const pkg = await SinglePackageRepo.create(this.ux);
    pkg.install();
    pkg.build();
    pkg.test();
  }

  private async updateEsTarget(): Promise<void> {
    const tsConfigPath = path.resolve('tsconfig.json');
    const tsConfig = await fs.readJson(tsConfigPath);
    set(asObject(tsConfig), 'compilerOptions.target', this.flags.target);
    this.ux.log(`Updating tsconfig target at ${tsConfigPath} to:`, this.flags.target);
    await fs.writeJson(tsConfigPath, tsConfig);
  }

  private async updateTsVesion(typescriptPkg: NpmPackage): Promise<void> {
    const newVersion = ensureString(this.flags.version || get(typescriptPkg, 'dist-tags.latest'));
    this.ux.log(`Updating typescript version to ${newVersion}`);
    const pkg = await Package.create(path.resolve('.'));

    if (pkg.packageJson.devDependencies['typescript']) {
      pkg.packageJson.devDependencies['typescript'] = newVersion;
    }

    // If the prepare script runs sf-install, the install will fail because the typescript version
    // won't match the expected version. So in that case, we delete the prepare script so that we
    // get a successful install
    if (pkg.packageJson.scripts['prepare'] === 'sf-install') {
      delete pkg.packageJson.scripts['prepare'];
    }

    pkg.writePackageJson();
  }

  private retrieveTsPackage(): NpmPackage {
    const result = exec('npm view typescript --json', { silent: true });
    if (result.code === 0) {
      return JSON.parse(result.stdout) as NpmPackage;
    } else {
      throw new SfdxError('Could not find typescript on the npm registry', 'TypescriptNotFound');
    }
  }

  private validateEsTarget(): boolean {
    if (this.flags.target === 'ESNext') return true;

    if (/ES[0-9]{4}/g.test(this.flags.target)) return true;

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new SfdxError(`Invalid target: ${this.flags.target}`, 'InvalidTargetVersion');
  }

  private validateTsVersion(typescriptPkg: NpmPackage): boolean {
    if (this.flags.version) {
      if (!typescriptPkg.versions.includes(this.flags.version)) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new SfdxError(`${this.flags.version} does not exist`, 'InvalidTypescriptVersion');
      }
    }
    return true;
  }
}
