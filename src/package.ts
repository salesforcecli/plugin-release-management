/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { exec } from 'shelljs';
import { fs, Logger } from '@salesforce/core';
import { AsyncOptionalCreatable } from '@salesforce/kit';
import { AnyJson, get } from '@salesforce/ts-types';

export type PackageJson = {
  name: string;
  version: string;
  dependencies: AnyJson;
  devDependencies: AnyJson;
  scripts: AnyJson;
} & AnyJson;

export type ChangedPackageVersions = Array<{
  name: string;
  version: string;
  tag: string;
}>;

export type NpmPackage = {
  name: string;
  version: string;
  versions: string[];
  'dist-tags': string[];
} & AnyJson;

export async function readPackageJson(rootDir?: string): Promise<PackageJson> {
  const pkgJsonPath = rootDir ? path.join(rootDir, 'package.json') : 'package.json';
  return (await fs.readJson(pkgJsonPath)) as PackageJson;
}

export interface VersionValidation {
  nextVersion: string;
  currentVersion: string;
  valid: boolean;
  name: string;
}

export class Package extends AsyncOptionalCreatable {
  public name: string;
  public npmPackage: NpmPackage;
  public packageJson: PackageJson;
  public location: string;

  private logger: Logger;
  private nextVersion: string;

  public constructor(location?: string) {
    super();
    this.location = location;
  }

  public async readPackageJson(): Promise<PackageJson> {
    const pkgJsonPath = this.location ? path.join(this.location, 'package.json') : 'package.json';
    return (await fs.readJson(pkgJsonPath)) as PackageJson;
  }

  public retrieveNpmPackage(): NpmPackage {
    const result = exec(`npm view ${this.name} --json`, { silent: true });
    return result.code === 0 ? (JSON.parse(result.stdout) as NpmPackage) : null;
  }

  public validateNextVersion(): VersionValidation {
    const nextVersionExists = this.npmPackage.versions.includes(this.nextVersion);
    if (!nextVersionExists) {
      this.logger.debug(`${this.npmPackage.name}@${this.nextVersion} does not exist in the registry. Proceeding...`);
      return {
        nextVersion: this.nextVersion,
        currentVersion: this.npmPackage.version,
        valid: true,
        name: this.name,
      };
    } else {
      this.logger.debug(`${this.npmPackage.name}@${this.nextVersion} already exists in the registry. Exiting...`);
      return {
        nextVersion: this.nextVersion,
        currentVersion: this.npmPackage.version,
        valid: false,
        name: this.name,
      };
    }
  }

  public setNextVersion(version: string): void {
    this.nextVersion = version;
  }

  public getNextVersion(): string {
    return this.nextVersion;
  }

  public nextVersionIsAvailable(): boolean {
    const pkg = this.retrieveNpmPackage();
    const versions = get(pkg, 'versions', []) as string[];
    return versions.includes(this.nextVersion);
  }

  public writePackageJson(rootDir?: string): void {
    const pkgJsonPath = rootDir ? path.join(rootDir, 'package.json') : 'package.json';
    fs.writeJsonSync(pkgJsonPath, this.packageJson);
  }

  public pinDependencyVersions(targetTag: string): ChangedPackageVersions {
    // get the list of dependencies to hardcode
    const dependencies: string[] = this.packageJson['pinnedDependencies'];
    const pinnedPackages = [];
    dependencies.forEach((name) => {
      // get the 'release' tag version or the version specified by the passed in tag
      const result = exec(`npm view ${name} dist-tags --json`, { silent: true });
      const versions = JSON.parse(result.stdout);
      let tag = targetTag;

      // if tag is 'latest-rc' and there's no latest-rc release for a package, default to latest
      if (!versions[tag]) {
        tag = 'latest';
      }

      const version = versions[tag];

      // insert the new hardcoded versions into the dependencies in the project's package.json
      this.packageJson['dependencies'][name] = version;

      // accumulate information to return
      pinnedPackages.push({ name, version, tag });
    });

    return pinnedPackages;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.packageJson = await this.readPackageJson();
    this.name = this.packageJson.name;
    this.npmPackage = this.retrieveNpmPackage() || this.createDefaultNpmPackage();
  }

  private createDefaultNpmPackage(): NpmPackage {
    return {
      name: this.name,
      version: this.packageJson.version,
      versions: [],
      'dist-tags': [],
    };
  }
}
