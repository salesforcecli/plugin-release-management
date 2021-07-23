/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as semver from 'semver';
import { cli } from 'cli-ux';
import { exec, pwd } from 'shelljs';
import { fs, Logger, SfdxError } from '@salesforce/core';
import { AsyncOptionalCreatable, findKey } from '@salesforce/kit';
import { AnyJson, get, Nullable } from '@salesforce/ts-types';
import { Registry } from './registry';

export type PackageJson = {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files?: string[];
  pinnedDependencies?: string[];
  repository?: string;
  sfdx?: PackageJsonSfdxProperty;
} & AnyJson;

export type PackageJsonSfdxProperty = {
  publicKeyUrl: string;
  signatureUrl: string;
};

export type ChangedPackageVersions = Array<{
  name: string;
  version: string;
  tag: string;
}>;

export type NpmPackage = {
  name: string;
  version: string;
  versions: string[];
  'dist-tags': Record<string, string>;
} & AnyJson;

export interface VersionValidation {
  nextVersion: string;
  currentVersion: string;
  valid: boolean;
  name: string;
}

interface PinnedPackage {
  name: string;
  version: string;
  tag: string;
  alias: Nullable<string>;
}

export class Package extends AsyncOptionalCreatable {
  public name: string;
  public npmPackage: NpmPackage;
  public packageJson: PackageJson;
  public location: string;

  private logger: Logger;
  private nextVersion: string;
  private registry: Registry;

  public constructor(location: string) {
    super();
    this.location = location || pwd().stdout;
    this.registry = new Registry();
  }

  public async readPackageJson(): Promise<PackageJson> {
    const pkgJsonPath = this.location ? path.join(this.location, 'package.json') : 'package.json';
    return (await fs.readJson(pkgJsonPath)) as PackageJson;
  }

  public retrieveNpmPackage(): NpmPackage {
    const result = exec(`npm view ${this.name} ${this.registry.getRegistryParameter()} --json`, { silent: true });
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
    if (!this.packageJson.pinnedDependencies) {
      throw new SfdxError(
        'Pinning package dependencies requires property "pinnedDependencies" to be present in package.json'
      );
    }
    const { pinnedDependencies, dependencies } = this.packageJson;
    const deps = pinnedDependencies.map((d) => {
      const tagRegex = /(?<=(^@.*?)@)(.*?)$/;
      const [tag] = tagRegex.exec(d) || [];
      const name = tag ? d.replace(new RegExp(`@${tag}$`), '') : d;
      const version = dependencies[name];

      if (version.startsWith('npm:')) {
        return {
          name: version.replace('npm:', '').replace(/@(\^|~)?[0-9]{1,3}(?:.[0-9]{1,3})?(?:.[0-9]{1,3})?(.*?)$/, ''),
          version: version.split('@').reverse()[0].replace('^', '').replace('~', ''),
          alias: name,
          tag: tag || targetTag,
        };
      } else {
        return {
          name,
          version: version.split('@').reverse()[0].replace('^', '').replace('~', ''),
          alias: null,
          tag: tag || targetTag,
        };
      }
    });

    const pinnedPackages: PinnedPackage[] = [];
    deps.forEach((dep) => {
      // get the 'release' tag version or the version specified by the passed in tag
      const result = exec(`npm view ${dep.name} dist-tags ${this.registry.getRegistryParameter()} --json`, {
        silent: true,
      });
      const versions = JSON.parse(result.stdout) as Record<string, string>;
      let tag = dep.tag;

      // if tag is 'latest-rc' and there's no latest-rc release for a package, default to latest
      if (!versions[tag]) {
        tag = 'latest';
      }

      // If the version in package.json is greater than the version of the requested tag, then we
      // assume that this is on purpose - so we don't overwrite it. For example, we might want to
      // include a latest-rc version for a single plugin but everything else we want latest.
      let version: string;
      if (semver.gt(dep.version, versions[tag])) {
        cli.warn(
          `${dep.name} is currently pinned at ${dep.version} which is higher than ${tag} (${versions[tag]}). Assuming that this is intentional...`
        );
        version = dep.version;
        tag = findKey(versions, (v) => v === version);
      } else {
        version = versions[tag];
      }

      // insert the new hardcoded versions into the dependencies in the project's package.json
      if (dep.alias) {
        this.packageJson['dependencies'][dep.alias] = `npm:${dep.name}@${version}`;
      } else {
        this.packageJson['dependencies'][dep.name] = version;
      }
      // accumulate information to return
      pinnedPackages.push({ name: dep.name, version, tag, alias: dep.alias });
    });

    return pinnedPackages;
  }

  /**
   * Returns true if the version specified in the package.json has not been
   * published to the registry
   */
  public nextVersionIsHardcoded(): boolean {
    return !this.npmPackage.versions.includes(this.packageJson.version);
  }

  public hasScript(scriptName: string): boolean {
    return !!get(this.packageJson, `scripts.${scriptName}`, null);
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
      'dist-tags': {},
    };
  }
}
