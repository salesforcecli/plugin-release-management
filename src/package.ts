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

export type ProjectJson = {
  name: string;
  version: string;
} & AnyJson;

export type NpmPackage = {
  name: string;
  version: string;
  versions: string[];
} & AnyJson;

export async function readProjectJson(rootDir?: string): Promise<ProjectJson> {
  const pkgJsonPath = rootDir ? path.join(rootDir, 'package.json') : 'package.json';
  return (await fs.readJson(pkgJsonPath)) as ProjectJson;
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
  public projectJson: ProjectJson;
  public location: string;

  private logger: Logger;
  private nextVersion: string;

  public constructor(location?: string) {
    super();
    this.location = location;
  }

  public async readProjectJson(): Promise<ProjectJson> {
    const pkgJsonPath = this.location ? path.join(this.location, 'package.json') : 'package.json';
    return (await fs.readJson(pkgJsonPath)) as ProjectJson;
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

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.projectJson = await this.readProjectJson();
    this.name = this.projectJson.name;
    this.npmPackage = this.retrieveNpmPackage() || this.createDefaultNpmPackage();
  }

  private createDefaultNpmPackage(): NpmPackage {
    return {
      name: this.name,
      version: this.projectJson.version,
      versions: [],
    };
  }
}
