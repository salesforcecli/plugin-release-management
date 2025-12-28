/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { ux } from '@oclif/core';
import shelljs from 'shelljs';
import { SfError } from '@salesforce/core';
import { AsyncOptionalCreatable, findKey, parseJson } from '@salesforce/kit';
import { AnyJson, isObject, isPlainObject } from '@salesforce/ts-types';
import { Registry } from './registry.js';

export type PackageJson = {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files?: string[];
  pinnedDependencies?: string[];
  resolutions?: Record<string, string>;
  repository?: string;
  homepage?: string;
  sfdx?: PackageJsonSfdxProperty;
  oclif?: {
    plugins?: string[];
    devPlugins?: string[];
    jitPlugins?: Record<string, string>;
  };
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
  time?: Record<string, string>;
} & Partial<PackageJson>;

export type VersionValidation = {
  nextVersion: string;
  currentVersion: string;
  valid: boolean;
  name: string;
};

type PinnedPackage = {
  name: string;
  version: string;
  tag: string;
};

type DependencyInfo = {
  packageName: string;
  currentVersion?: string;
  finalVersion?: string;
};

export function parsePackageVersion(alias: string): string | undefined {
  const regex = /[0-9]{1,3}(?:.[0-9]{1,3})?(?:.[0-9]{1,3})?(.*?)$/;
  return regex.exec(alias)?.[0];
}

export class Package extends AsyncOptionalCreatable {
  // three props set during init
  public name!: string;
  public npmPackage!: NpmPackage;
  public packageJson!: PackageJson;
  public location: string;

  private registry: Registry;

  public constructor(opts: { location?: string } | undefined) {
    super();
    this.location = opts?.location ?? shelljs.pwd().stdout;
    this.registry = new Registry();
  }

  public async readPackageJson(): Promise<PackageJson> {
    const pkgJsonPath = this.location ? path.join(this.location, 'package.json') : 'package.json';
    const fileData = await fs.promises.readFile(pkgJsonPath, 'utf8');
    return parseJson(fileData, pkgJsonPath, false) as PackageJson;
  }

  /**
   * Retrieve the npm package info using `npm view`
   *
   * It'll first try to find the package with the version listed in the package.json
   * If that version doesn't exist, it'll find the version tagged as latest
   */
  public retrieveNpmPackage(): NpmPackage | undefined {
    let result = shelljs.exec(
      `npm view ${this.name}@${this.packageJson.version} ${this.registry.getRegistryParameter()} --json`,
      { silent: true }
    );
    if (!result.stdout) {
      result = shelljs.exec(`npm view ${this.name} ${this.registry.getRegistryParameter()} --json`, { silent: true });
    }
    if (result.stdout) {
      return JSON.parse(result.stdout) as NpmPackage;
    }
  }

  public nextVersionIsAvailable(nextVersion: string): boolean {
    const pkg = this.retrieveNpmPackage();
    return pkg?.versions?.includes(nextVersion) ?? false;
  }

  public writePackageJson(rootDir?: string): void {
    const pkgJsonPath = rootDir ? path.join(rootDir, 'package.json') : 'package.json';
    const fileData: string = JSON.stringify(this.packageJson, null, 2);
    fs.writeFileSync(pkgJsonPath, fileData, {
      encoding: 'utf8',
      mode: '600',
    });
  }

  public calculatePinnedPackageUpdates(pinnedPackages: PinnedPackage[]): PinnedPackage[] {
    return pinnedPackages.map((dep) => {
      const versions = this.getDistTags(dep.name);
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
        ux.warn(
          `${dep.name} is currently pinned at ${dep.version} which is higher than ${tag} (${versions[tag]}). Assuming that this is intentional...`
        );
        version = dep.version;
        const matchedTag = findKey(versions, (v) => v === version);
        tag = matchedTag ?? tag;
      } else {
        version = versions[tag];
      }
      return { name: dep.name, version, tag };
    });
  }

  public getDistTags(name: string): Record<string, string> {
    const result = shelljs.exec(`npm view ${name} dist-tags ${this.registry.getRegistryParameter()} --json`, {
      silent: true,
    });
    if (result.stdout) {
      return JSON.parse(result.stdout) as Record<string, string>;
    }
    ux.error(result.stderr);
  }

  public bumpResolutions(tag: string): Record<string, string> {
    if (!this.packageJson.resolutions) {
      throw new SfError('Bumping resolutions requires property "resolutions" to be present in package.json');
    }

    return Object.fromEntries(
      Object.entries(this.packageJson.resolutions).map(([key]) => {
        const versions = this.getDistTags(key);
        return [key, versions[tag]];
      })
    );
  }

  /**
   * Lookup dependency info by package name
   * Examples: @salesforce/plugin-info
   * Pass in the dependencies you want to search through (dependencies, devDependencies, resolutions, etc)
   */
  // eslint-disable-next-line class-methods-use-this
  public getDependencyInfo(name: string, dependencies: Record<string, string>): DependencyInfo {
    const match = Object.entries(dependencies).find(([key]) => key === name);
    if (match) {
      const [matchingName, value] = match;
      return {
        packageName: matchingName,
        currentVersion: value,
      };
    } else {
      ux.error(`${name} was not found in the dependencies section of the package.json`);
    }
  }

  public bumpDependencyVersions(targetDependencies: string[]): DependencyInfo[] {
    return targetDependencies
      .map((dep) => {
        // regex for npm package with optional namespace and version
        // https://regex101.com/r/HmIu3N/1
        const npmPackageRegex = /^((?:@[^/]+\/)?[^@/]+)(?:@([^@/]+))?$/;
        const [, name, version] = npmPackageRegex.exec(dep) ?? [];

        // We will look for packages in dependencies and resolutions
        const { dependencies, resolutions } = this.packageJson;
        const jitPlugins = this.packageJson.oclif?.jitPlugins ?? {};

        // find dependency in package.json (could be an npm alias)
        const depInfo = this.getDependencyInfo(name, { ...dependencies, ...resolutions, ...jitPlugins });

        // if a version is not provided, we'll look up the "latest" version
        depInfo.finalVersion = version ?? this.getDistTags(depInfo.packageName).latest;

        // return if version did not change
        if (depInfo.currentVersion === depInfo.finalVersion) return;

        // update dependency (or resolution) in package.json
        if (dependencies[depInfo.packageName]) {
          this.packageJson.dependencies[depInfo.packageName] = depInfo.finalVersion;
        } else if (resolutions?.[depInfo.packageName] && this.packageJson.resolutions) {
          this.packageJson.resolutions[depInfo.packageName] = depInfo.finalVersion;
        } else if (this.packageJson.oclif?.jitPlugins) {
          this.packageJson.oclif.jitPlugins[depInfo.packageName] = depInfo.finalVersion;
        }

        return depInfo;
      })
      .filter((item): item is DependencyInfo => Boolean(item)); // remove falsy values, in this case the `undefined` if version did not change
  }

  public determineNextVersion(isPatch = false, prerelease?: string): string {
    const currentVersion = this.packageJson.version;

    const releaseType = prerelease ? 'prerelease' : isPatch ? 'patch' : 'minor';

    const result = semver.inc(currentVersion, releaseType, prerelease);
    if (!result) {
      throw new SfError(
        `Unable to determine next version from ${currentVersion} and ${releaseType}.  semver.inc returned null (invalid version)`
      );
    }
    return result;
  }

  public pinDependencyVersions(targetTag: string): ChangedPackageVersions {
    // get the list of dependencies to hardcode
    if (!this.packageJson.pinnedDependencies) {
      throw new SfError(
        'Pinning package dependencies requires property "pinnedDependencies" to be present in package.json'
      );
    }
    const { pinnedDependencies, dependencies } = this.packageJson;
    const deps = pinnedDependencies
      .map((d) => {
        const [name, tag] = getNameAndTag(d);
        if (!dependencies[name]) {
          ux.warn(`${name} was not found in the dependencies section of your package.json. Skipping...`);
          return;
        }

        const version = dependencies[name];
        return getPinnedPackage({ name, version, tag, targetTag });
      })
      .filter((pp): pp is PinnedPackage => isPlainObject(pp));

    const updatedDeps = this.calculatePinnedPackageUpdates(deps);

    updatedDeps.forEach((pp) => {
      this.packageJson.dependencies[pp.name] = pp.version;
    });
    return updatedDeps;
  }

  public bumpJit(targetTag = 'latest-rc'): ChangedPackageVersions | undefined {
    const { pinnedDependencies, dependencies, devDependencies, oclif } = this.packageJson;
    // no JIT is ok
    if (!oclif?.jitPlugins) {
      return;
    }
    const jitDeps = Object.entries(oclif.jitPlugins)
      .map(([plugin, version]) => {
        const [name, tag] = getNameAndTag(plugin);
        if (
          dependencies?.[name] ??
          devDependencies?.[name] ??
          pinnedDependencies?.includes(name) ??
          oclif.plugins?.includes(name) ??
          oclif.devPlugins?.includes(name)
        ) {
          throw new SfError(
            'JIT plugins should not be listed in dependencies, devDependencies, pinnedDependencies, oclif.plugins or oclif.devPlugins. '
          );
        }
        return getPinnedPackage({ name, version, tag, targetTag });
      })
      .filter(isObject);

    const updatedDeps = this.calculatePinnedPackageUpdates(jitDeps);

    // side effect: mutate package.json reference
    updatedDeps.forEach((pp) => {
      if (this.packageJson.oclif?.jitPlugins) {
        if (this.packageJson.oclif?.jitPlugins) {
          this.packageJson.oclif.jitPlugins[pp.name] = pp.version;
        }
      }
    });

    return updatedDeps;
  }

  /**
   * Returns true if the version specified in the package.json has not been
   * published to the registry
   */
  public nextVersionIsHardcoded(): boolean {
    return !(this.npmPackage.versions ?? []).includes(this.packageJson.version);
  }

  public hasScript(scriptName: string): boolean {
    return typeof this.packageJson.scripts[scriptName] === 'string';
  }

  protected async init(): Promise<void> {
    this.packageJson = await this.readPackageJson();
    this.name = this.packageJson.name;
    this.npmPackage = this.retrieveNpmPackage() ?? this.createDefaultNpmPackage();
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

const getNameAndTag = (plugin: string): [name: string, tag: string | undefined] => {
  const tagRegex = /(?<=(^@.*?)@)(.*?)$/;
  const [tag] = tagRegex.exec(plugin) ?? [];
  const name = tag ? plugin.replace(new RegExp(`@${tag}$`), '') : plugin;
  return [name, tag];
};

/** standardize various plugin formats/targets to a PinnedPackage */
const getPinnedPackage = ({
  name,
  version,
  tag,
  targetTag,
}: {
  name: string;
  version: string;
  tag?: string;
  targetTag: string;
}): PinnedPackage => ({
  name,
  version: version.split('@').reverse()[0].replace('^', '').replace('~', ''),
  tag: tag ?? targetTag,
});
