/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfError } from '@salesforce/core';
import { exec } from 'shelljs';
import { set } from '@salesforce/kit';
import { AnyJson, asObject, getString } from '@salesforce/ts-types';
import { NpmPackage, Package } from '../../package';
import { PackageRepo } from '../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'typescript.update', [
  'description',
  'typescriptVersion',
  'esTarget',
  'InvalidTargetVersion',
  'InvalidTypescriptVersion',
]);

export default class Update extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    version: flags.string({
      char: 'v',
      description: messages.getMessage('typescriptVersion'),
      default: 'latest',
    }),
    target: flags.string({
      char: 't',
      description: messages.getMessage('esTarget'),
      default: 'ESNext',
    }),
  };

  private typescriptPkg: NpmPackage;
  private repo: PackageRepo;
  private packages: Package[];

  public async run(): Promise<void> {
    this.typescriptPkg = retrieveTsPackage();
    this.validateEsTarget();
    this.validateTsVersion();

    this.repo = await PackageRepo.create({ ux: this.ux });

    this.packages = this.getPackages();

    this.ux.warn('This is for testing new versions only. To update the version you must go through dev-scripts.');

    this.updateTsVersion();
    for (const pkg of this.packages) {
      // this.packages is singular in a non-lerna world
      // eslint-disable-next-line no-await-in-loop
      await this.updateEsTargetConfig(pkg.location);
    }

    try {
      this.repo.install();
      this.repo.build();
      this.repo.test();
    } finally {
      this.ux.log('Reverting unstaged stages');
      this.repo.revertUnstagedChanges();
    }
  }

  private getPackages(): Package[] {
    return [this.repo.package];
  }

  private async updateEsTargetConfig(packagePath: string): Promise<void> {
    const tsConfigPath = path.join(packagePath, 'tsconfig.json');
    const tsConfigString = await fs.readFile(tsConfigPath, 'utf-8');

    // strip out any comments that might be in the tsconfig.json
    const commentRegex = new RegExp(/(\/\/.*)/, 'gi');
    const tsConfig = JSON.parse(tsConfigString.replace(commentRegex, '')) as AnyJson;

    set(asObject(tsConfig), 'compilerOptions.target', this.flags.target);
    this.ux.log(`Updating tsconfig target at ${tsConfigPath} to:`, this.flags.target as string);
    const fileData: string = JSON.stringify(tsConfig, null, 2);
    await fs.writeFile(tsConfigPath, fileData, {
      encoding: 'utf8',
      mode: '600',
    });
  }

  private updateTsVersion(): void {
    const newVersion = this.determineNextTsVersion();
    for (const pkg of this.packages) {
      if (pkg.packageJson.devDependencies['typescript']) {
        this.ux.warn(`Updating typescript version to ${newVersion} in path ${pkg.location}`);
        pkg.packageJson.devDependencies['typescript'] = newVersion;
        pkg.packageJson.devDependencies['@typescript-eslint/eslint-plugin'] = 'latest';
        pkg.packageJson.devDependencies['@typescript-eslint/parser'] = 'latest';
      }

      // If the prepare script runs sf-install, the install will fail because the typescript version
      // won't match the expected version. So in that case, we delete the prepare script so that we
      // get a successful install
      if (pkg.packageJson.scripts['prepare'] === 'sf-install') {
        delete pkg.packageJson.scripts['prepare'];
      }

      pkg.writePackageJson(pkg.location);
    }
  }

  private determineNextTsVersion(): string {
    return this.flags.version === 'latest' || !this.flags.version
      ? getString(this.typescriptPkg, 'dist-tags.latest')
      : (this.flags.version as string);
  }

  private validateEsTarget(): boolean {
    if (this.flags.target === 'ESNext') return true;

    if (/ES[0-9]{4}/g.test(this.flags.target as string)) return true;

    throw new SfError(messages.getMessage('InvalidTargetVersion'), 'InvalidTargetVersion', [
      this.flags.target as string,
    ]);
  }

  private validateTsVersion(): boolean {
    const version = this.flags.version as string;
    if (version === 'latest') return true;
    if (version && !this.typescriptPkg.versions.includes(version)) {
      throw new SfError(messages.getMessage('InvalidTypescriptVersion'), 'InvalidTypescriptVersion', [version]);
    }
    return true;
  }
}

const retrieveTsPackage = (): NpmPackage => {
  const result = exec('npm view typescript --json', { silent: true });
  if (result.code === 0) {
    return JSON.parse(result.stdout) as NpmPackage;
  } else {
    throw new SfError('Could not find typescript on the npm registry', 'TypescriptNotFound');
  }
};
