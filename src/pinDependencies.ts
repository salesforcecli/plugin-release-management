/*
 * Copyright 2026, Salesforce, Inc.
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
import shelljs from 'shelljs';
import { SfError } from '@salesforce/core';
import { parseJson } from '@salesforce/kit';
import { PackageJson } from './package.js';
import { Registry } from './registry.js';

export const CLI_PACKAGE = '@salesforce/cli';
// Plugins can become core on any channel, so check every channel the CLI ships.
const CLI_TAGS = ['latest', 'latest-rc', 'nightly'];

type InstalledPackage = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  os?: string[];
  cpu?: string[];
  libc?: string[];
};

export type PinnedDependencies = {
  dependencies: Record<string, string>;
  /** production packages yarn could only install nested, so npm still resolves them from their ranges */
  nested: string[];
};

/**
 * The CLI's core plugins are installed next to each other and must dedupe shared deps (@salesforce/core, ...),
 * so only the CLI and plugins installed on their own (JIT, user installed) get pinned. Libraries never do.
 */
export const pinSkipReason = (
  packageJson: PackageJson,
  getPlugins: () => string[] = getCorePlugins
): string | undefined => {
  if (!packageJson.oclif) return 'it is a library (no "oclif" property in package.json)';
  if (packageJson.name === CLI_PACKAGE) return;
  const corePlugins = getPlugins();
  if (corePlugins.includes(packageJson.name)) return `it is a core plugin of ${CLI_PACKAGE}`;
};

/** Any lookup failure throws: pinning a core plugin by mistake duplicates @salesforce/core and friends in the CLI. */
export const getCorePlugins = (registry = new Registry()): string[] => {
  const lists = CLI_TAGS.map((tag) => {
    const result = shelljs.exec(
      `npm view ${CLI_PACKAGE}@${tag} oclif.plugins ${registry.getRegistryParameter()} --json`,
      { silent: true }
    );
    // a channel that doesn't exist (E404 or no output) has no core plugins
    if (result.code === 0 ? !result.stdout.trim() : (result.stdout + result.stderr).includes('E404')) return [];
    let plugins: unknown;
    try {
      plugins = result.code === 0 ? JSON.parse(result.stdout) : undefined;
    } catch {
      plugins = undefined;
    }
    if (!Array.isArray(plugins)) {
      throw new SfError(
        `Could not read the core plugins of ${CLI_PACKAGE}@${tag}: ${result.stderr || result.stdout}`,
        'CorePluginLookupFailed',
        ['Retry the release, or pass --no-pin-dependencies to publish without pinning.']
      );
    }
    return plugins.filter((p): p is string => typeof p === 'string');
  });
  return [...new Set(lists.flat())];
};

const isRegistrySpec = (spec: string): boolean => spec.startsWith('npm:') || semver.validRange(spec) !== null;

const readInstalled = (dir: string): InstalledPackage | undefined => {
  const pkgJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;
  return parseJson(fs.readFileSync(pkgJsonPath, 'utf8'), pkgJsonPath, false) as unknown as InstalledPackage;
};

/** node resolution: look in each node_modules from the requiring package up to the root */
const resolveInstalled = (rootDir: string, fromDir: string, name: string): string | undefined => {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    if (path.basename(dir) !== 'node_modules') {
      const candidate = path.join(dir, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    }
    if (dir === rootDir || path.dirname(dir) === dir) return;
  }
};

const isPlatformSpecific = (installed: InstalledPackage): boolean =>
  Boolean(installed.os ?? installed.cpu ?? installed.libc);

const pinSpec = (name: string, installed: InstalledPackage): string =>
  installed.name === name || typeof installed.name !== 'string'
    ? installed.version
    : `npm:${installed.name}@${installed.version}`;

const pinnedVersion = (spec: string): string => spec.slice(spec.lastIndexOf('@') + 1);

/**
 * yarn only warns about unmet peers, but npm fails with ERESOLVE when both sides are pinned next to each other.
 * Unpin the transitive side so npm is free to nest it with a peer it accepts.
 */
const dropPeerConflicts = (
  pinned: Map<string, string>,
  manifests: Map<string, InstalledPackage>,
  direct: Record<string, string>
): void => {
  for (const [name, manifest] of manifests) {
    for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
      const peerSpec = pinned.get(peer);
      if (
        !pinned.has(name) ||
        !peerSpec ||
        manifest.peerDependenciesMeta?.[peer]?.optional ||
        semver.satisfies(pinnedVersion(peerSpec), range, { includePrerelease: true })
      ) {
        continue;
      }
      if (!(name in direct)) pinned.delete(name);
      else if (!(peer in direct)) pinned.delete(peer);
    }
  }
};

/**
 * Build `dependencies` with the exact version of every production package installed at the top of node_modules.
 * npm ignores yarn.lock and resolutions when the package is installed from the registry, but it does dedupe
 * transitive ranges onto top-level exact versions, so the published package installs (nearly) the tree yarn.lock
 * built. Packages yarn had to nest still resolve from their ranges, and are reported.
 */
export const pinInstalledDependencies = (rootDir: string, packageJson: PackageJson): PinnedDependencies => {
  const root = path.resolve(rootDir);
  const direct = packageJson.dependencies ?? {};
  // folder name -> pinned spec, or undefined once any dependent requests it from git, a file, a tag, ...
  const hoisted = new Map<string, string | undefined>();
  const nested = new Set<string>();
  const walked = new Map<string, boolean>();
  const manifests = new Map<string, InstalledPackage>();
  const queue: Array<{ from: string; name: string; spec: string; required: boolean }> = Object.entries(direct).map(
    ([name, spec]) => ({ from: root, name, spec, required: true })
  );

  for (let next = queue.shift(); next; next = queue.shift()) {
    const { from, name, spec, required } = next;
    const dir = resolveInstalled(root, from, name);
    const installed = dir ? readInstalled(dir) : undefined;
    if (!dir || !installed) {
      if (from === root) {
        throw new SfError(
          `${name} is a dependency but is not installed in ${path.join(root, 'node_modules')}. Run yarn install first.`,
          'DependencyNotInstalled'
        );
      }
      continue;
    }

    // Optional and platform specific packages (fsevents, @esbuild/linux-x64, ...) must stay optional.
    if (required && !isPlatformSpecific(installed)) {
      if (dir === path.join(root, 'node_modules', name)) {
        const pinned = pinSpec(name, installed);
        const previous = hoisted.has(name) ? hoisted.get(name) : pinned;
        hoisted.set(name, previous && isRegistrySpec(spec) ? pinned : undefined);
        manifests.set(name, installed);
      } else {
        nested.add(name);
      }
    }

    // walk again if a package seen only through optional edges turns out to be required
    if (walked.get(dir) === true || (walked.has(dir) && !required)) continue;
    walked.set(dir, required);
    const optional = { ...installed.peerDependencies, ...installed.optionalDependencies };
    queue.push(
      // npm treats a package listed in both dependencies and optionalDependencies as optional
      ...Object.entries(installed.dependencies ?? {})
        .filter(([n]) => !installed.optionalDependencies?.[n])
        .map(([n, s]) => ({ from: dir, name: n, spec: s, required })),
      ...Object.entries(optional).map(([n, s]) => ({ from: dir, name: n, spec: s, required: false }))
    );
  }

  const pinned = new Map([...hoisted].filter((entry): entry is [string, string] => entry[1] !== undefined));
  pinned.delete(packageJson.name);
  dropPeerConflicts(pinned, manifests, direct);
  const dependencies = Object.fromEntries(
    [...new Set([...Object.keys(direct), ...pinned.keys()])]
      .sort()
      .map((name) => [name, pinned.get(name) ?? direct[name]])
  );
  return { dependencies, nested: [...nested].filter((name) => !hoisted.has(name)).sort() };
};
