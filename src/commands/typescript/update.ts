/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as glob from 'glob';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs, Messages, SfdxError } from '@salesforce/core';
import { exec, pwd, cd } from 'shelljs';
import { set } from '@salesforce/kit';
import { AnyJson, asObject, getString } from '@salesforce/ts-types';
import { NpmPackage, Package } from '../../package';
import { SinglePackageRepo, LernaRepo, LernaJson, isMonoRepo } from '../../repository';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'typescript.update');

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

  private typescriptPkgs: NpmPackage[];

  public async run(): Promise<void> {
    this.typescriptPkgs = await this.retrieveTsPackages();
    this.validateEsTarget();
    this.validateTsVersion();

    const pkg = (await isMonoRepo())
      ? await LernaRepo.create({ ux: this.ux })
      : await SinglePackageRepo.create({ ux: this.ux });

    this.ux.warn('This is for testing new versions only. To update the version you must go through dev-scripts.');

    await this.updateTsVersion();
    await this.updateEsTarget();

    if (await isMonoRepo()) {
      const packagePaths = await this.getPackagePaths();
      const workingDir = pwd().stdout;

      for (const packagePath of packagePaths) {
        cd(path.resolve(packagePath));
        try {
          pkg.install();
          pkg.build();
          pkg.test();
        } finally {
          this.ux.log('Reverting unstaged stages');
          cd(workingDir);
          pkg.revertUnstagedChanges();
        }
        cd(workingDir);
      }
    } else {
      try {
        pkg.install();
        pkg.build();
        pkg.test();
      } finally {
        this.ux.log('Reverting unstaged stages');
        pkg.revertUnstagedChanges();
      }
    }
  }

  private isLernaRepo(): boolean {
    const lernaConfigPath = path.resolve('lerna.json');
    return fs.existsSync(lernaConfigPath);
  }

  private async getPackagePaths(): Promise<string[]> {
    const workingDir = pwd().stdout;
    const lernaJson = (await fs.readJson('lerna.json')) as LernaJson;
    const packageGlobs = lernaJson.packages || ['*'];
    const packages = packageGlobs
      .map((pGlob) => glob.sync(pGlob))
      .reduce((x, y) => x.concat(y), [])
      .map((pkg) => path.join(workingDir, pkg));
    return packages;
  }

  private async updateEsTargetConfig(packagePath: string): Promise<void> {
    const tsConfigPath = path.join(packagePath, 'tsconfig.json');
    const tsConfigString = await fs.readFile(tsConfigPath, 'utf-8');

    // strip out any comments that might be in the tsconfig.json
    const commentRegex = new RegExp(/(\/\/.*)/, 'gi');
    const tsConfig = JSON.parse(tsConfigString.replace(commentRegex, '')) as AnyJson;

    set(asObject(tsConfig), 'compilerOptions.target', this.flags.target);
    this.ux.log(`Updating tsconfig target at ${tsConfigPath} to:`, this.flags.target);
    await fs.writeJson(tsConfigPath, tsConfig);
  }

  private async updateEsTarget(): Promise<void> {
    if (await isMonoRepo()) {
      const packagePaths = await this.getPackagePaths();
      for (const packagePath of packagePaths) {
        await this.updateEsTargetConfig(packagePath);
      }
    } else {
      await this.updateEsTargetConfig('.');
    }
    return;
  }

  private async updatePackage(packagePath: string, npmPackage: NpmPackage): Promise<void> {
    const newVersion = this.determineNextTsVersion(npmPackage);
    const pkg = await Package.create(path.resolve(packagePath));
    if (pkg.packageJson.devDependencies['typescript']) {
      this.ux.log(`Updating typescript version to ${newVersion}`);
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
    return pkg.writePackageJson();
  }

  private async updateTsVersion(): Promise<void> {
    if (await isMonoRepo()) {
      const packagePaths = await this.getPackagePaths();
      const runner = exec('npm view typescript --json', { silent: true });
      if (runner.code !== 0) {
        throw new SfdxError('Could not find typescript on the npm registry', 'TypescriptNotFound');
      }
      for (const packagePath of packagePaths) {
        const npmPackage = JSON.parse(runner.stdout) as NpmPackage;
        await this.updatePackage(packagePath, npmPackage);
      }
      return;
    }

    this.typescriptPkgs.map(async (typescriptPkg) => {
      this.ux.log(typescriptPkg.version);
      await this.updatePackage(path.resolve('.'), typescriptPkg);
    });
  }

  private determineNextTsVersion(typescriptPkg: NpmPackage): string {
    return this.flags.version === 'latest' || !this.flags.version
      ? getString(typescriptPkg, 'dist-tags.latest')
      : (this.flags.version as string);
  }

  private async retrieveTsPackages(): Promise<NpmPackage[]> {
    // Process lerna repos
    if (await isMonoRepo()) {
      const workingDir = pwd().stdout;
      const lernaProjects = await this.getPackagePaths();
      const result = lernaProjects.map((packagePath) => {
        cd(path.resolve(packagePath));
        const runner = exec('npm view typescript --json', { silent: true });
        cd(workingDir);
        if (runner.code === 0) {
          return JSON.parse(runner.stdout) as NpmPackage;
        } else {
          throw new SfdxError('Could not find typescript on the npm registry', 'TypescriptNotFound');
        }
      });
      return result;
    }
    // Process regular packages
    const runner = exec('npm view typescript --json', { silent: true });
    if (runner.code === 0) {
      return [JSON.parse(runner.stdout)] as NpmPackage[];
    } else {
      throw new SfdxError('Could not find typescript on the npm registry', 'TypescriptNotFound');
    }
  }

  private validateEsTarget(): boolean {
    if (this.flags.target === 'ESNext') return true;

    if (/ES[0-9]{4}/g.test(this.flags.target)) return true;

    throw SfdxError.create('@salesforce/plugin-release-management', 'typescript.update', 'InvalidTargetVersion', [
      this.flags.target,
    ]);
  }

  private validateTsVersion(): boolean {
    if (this.flags.version === 'latest') return true;
    if (
      this.flags.version &&
      !this.typescriptPkgs.some((typescriptPkg) => typescriptPkg.versions.includes(this.flags.version))
    ) {
      throw SfdxError.create('@salesforce/plugin-release-management', 'typescript.update', 'InvalidTypescriptVersion', [
        this.flags.version,
      ]);
    }
    return true;
  }
}
