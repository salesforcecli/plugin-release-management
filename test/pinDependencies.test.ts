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
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import shelljs from 'shelljs';
import sinon from 'sinon';
import { PackageJson } from '../src/package.js';
import { Registry } from '../src/registry.js';
import { CLI_PACKAGE, getCorePlugins, pinInstalledDependencies, pinSkipReason } from '../src/pinDependencies.js';

const pJson = (pkg: Partial<PackageJson>): PackageJson =>
  ({ name: 'my-plugin', version: '1.0.0', devDependencies: {}, scripts: {}, dependencies: {}, ...pkg } as PackageJson);

describe('pinDependencies', () => {
  describe('pinSkipReason', () => {
    const noLookup = (): string[] => expect.fail('core plugins should not be looked up');

    it('skips libraries', () => {
      expect(pinSkipReason(pJson({ name: '@salesforce/core' }), noLookup)).to.include('library');
    });

    it('pins the CLI without looking up core plugins', () => {
      expect(pinSkipReason(pJson({ name: CLI_PACKAGE, oclif: {} }), noLookup)).to.be.undefined;
    });

    it('skips core plugins', () => {
      const pkg = pJson({ name: '@salesforce/plugin-auth', oclif: {} });
      expect(pinSkipReason(pkg, () => ['@salesforce/plugin-auth'])).to.include('core plugin');
    });

    it('pins plugins that are not core', () => {
      const pkg = pJson({ name: '@salesforce/plugin-community', oclif: {} });
      expect(pinSkipReason(pkg, () => ['@salesforce/plugin-auth'])).to.be.undefined;
    });
  });

  describe('getCorePlugins', () => {
    const sandbox = sinon.createSandbox();
    const view = (byTag: Record<string, { code: number; stdout: string; stderr?: string }>): void => {
      sandbox.stub(shelljs, 'exec').callsFake(((cmd: string) => {
        const tag = /@salesforce\/cli@(\S+)/.exec(cmd)?.[1] ?? '';
        return { stderr: '', ...byTag[tag] };
      }) as unknown as typeof shelljs.exec);
    };

    const registry = { getRegistryParameter: () => '' } as unknown as Registry;

    afterEach(() => sandbox.restore());

    it('combines the core plugins of every channel', () => {
      view({
        latest: { code: 0, stdout: '["@salesforce/plugin-auth"]' },
        'latest-rc': { code: 0, stdout: '["@salesforce/plugin-auth","@salesforce/plugin-new"]' },
        nightly: { code: 0, stdout: '' },
      });
      expect(getCorePlugins(registry)).to.deep.equal(['@salesforce/plugin-auth', '@salesforce/plugin-new']);
    });

    it('ignores channels that do not exist', () => {
      view({
        latest: { code: 0, stdout: '["@salesforce/plugin-auth"]' },
        'latest-rc': { code: 1, stdout: '{"error":{"code":"E404"}}' },
        nightly: { code: 0, stdout: '["@salesforce/plugin-auth"]' },
      });
      expect(getCorePlugins(registry)).to.deep.equal(['@salesforce/plugin-auth']);
    });

    it('throws instead of guessing when a channel cannot be read', () => {
      view({
        latest: { code: 1, stdout: '', stderr: 'ETIMEDOUT' },
        'latest-rc': { code: 0, stdout: '["@salesforce/plugin-auth"]' },
        nightly: { code: 0, stdout: '["@salesforce/plugin-auth"]' },
      });
      expect(() => getCorePlugins(registry))
        .to.throw(/ETIMEDOUT/)
        .with.property('name', 'CorePluginLookupFailed');
    });

    it('throws on output that is not a plugin list', () => {
      view({
        latest: { code: 0, stdout: '<html>proxy error</html>' },
        'latest-rc': { code: 0, stdout: '[]' },
        nightly: { code: 0, stdout: '[]' },
      });
      expect(() => getCorePlugins(registry))
        .to.throw()
        .with.property('name', 'CorePluginLookupFailed');
    });
  });

  describe('pinInstalledDependencies', () => {
    let root: string;

    const install = (dir: string, pkg: Record<string, unknown>): void => {
      fs.mkdirSync(path.join(root, dir), { recursive: true });
      fs.writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify(pkg));
    };

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-deps-'));
    });

    afterEach(() => {
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('pins direct and hoisted transitive dependencies to their installed versions', () => {
      install('node_modules/@salesforce/sdr', {
        name: '@salesforce/sdr',
        version: '13.8.3',
        dependencies: { semver: '^6.0.0' },
      });
      install('node_modules/semver', { name: 'semver', version: '6.3.1' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { '@salesforce/sdr': '^13.4.6' } }));
      expect(result).to.deep.equal({ dependencies: { '@salesforce/sdr': '13.8.3', semver: '6.3.1' }, nested: [] });
    });

    it('reports nested packages instead of pinning them', () => {
      install('node_modules/a', { name: 'a', version: '1.0.0', dependencies: { semver: '^7.0.0', b: '^1' } });
      install('node_modules/a/node_modules/semver', { name: 'semver', version: '7.7.2' });
      install('node_modules/semver', { name: 'semver', version: '6.3.1' });
      install('node_modules/b', { name: 'b', version: '1.2.0', dependencies: { semver: '^6' } });
      install('node_modules/c', { name: 'c', version: '1.0.0', dependencies: { only: '^1' } });
      install('node_modules/c/node_modules/only', { name: 'only', version: '1.0.0' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1', c: '^1' } }));
      expect(result).to.deep.equal({
        dependencies: { a: '1.0.0', b: '1.2.0', c: '1.0.0', semver: '6.3.1' },
        nested: ['only'],
      });
    });

    it('does not pin dev dependencies, the package itself, or anything only reachable through optional edges', () => {
      install('node_modules/a', {
        name: 'a',
        version: '1.0.0',
        dependencies: { 'my-plugin': '^1' },
        optionalDependencies: { fsevents: '^2' },
        peerDependencies: { peer: '*' },
      });
      install('node_modules/my-plugin', { name: 'my-plugin', version: '1.0.0' });
      install('node_modules/fsevents', { name: 'fsevents', version: '2.3.3', dependencies: { inner: '^1' } });
      install('node_modules/inner', { name: 'inner', version: '1.0.0' });
      install('node_modules/peer', { name: 'peer', version: '1.0.0' });
      install('node_modules/mocha', { name: 'mocha', version: '10.0.0' });
      const result = pinInstalledDependencies(
        root,
        pJson({ dependencies: { a: '^1' }, devDependencies: { mocha: '^10' } })
      );
      expect(result.dependencies).to.deep.equal({ a: '1.0.0' });
    });

    it('pins a package reached optionally first and required later', () => {
      install('node_modules/a', { name: 'a', version: '1.0.0', optionalDependencies: { b: '^1' } });
      install('node_modules/z', { name: 'z', version: '1.0.0', dependencies: { b: '^1' } });
      install('node_modules/b', { name: 'b', version: '1.0.0', dependencies: { c: '^1' } });
      install('node_modules/c', { name: 'c', version: '1.0.0' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1', z: '^1' } }));
      expect(result.dependencies).to.deep.equal({ a: '1.0.0', b: '1.0.0', c: '1.0.0', z: '1.0.0' });
    });

    it('keeps platform specific packages unpinned', () => {
      install('node_modules/a', { name: 'a', version: '1.0.0', dependencies: { native: '^1' } });
      install('node_modules/native', { name: 'native', version: '1.0.0', os: ['darwin'] });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1', native: '^1' } }));
      expect(result.dependencies).to.deep.equal({ a: '1.0.0', native: '^1' });
    });

    it('pins npm aliases and leaves non-registry dependencies alone', () => {
      install('node_modules/strip-ansi', { name: 'strip-ansi', version: '6.0.1' });
      install('node_modules/string-width-cjs', { name: 'string-width', version: '4.2.3' });
      install('node_modules/forked', { name: 'forked', version: '2.0.0' });
      install('node_modules/a', { name: 'a', version: '1.0.0', dependencies: { gitdep: 'github:org/gitdep' } });
      install('node_modules/gitdep', { name: 'gitdep', version: '0.1.0' });
      const result = pinInstalledDependencies(
        root,
        pJson({
          dependencies: {
            'strip-ansi': '^6',
            'string-width-cjs': 'npm:string-width@^4.2.0',
            forked: 'github:org/forked#main',
            a: '^1',
          },
        })
      );
      expect(result.dependencies).to.deep.equal({
        a: '1.0.0',
        forked: 'github:org/forked#main',
        'string-width-cjs': 'npm:string-width@4.2.3',
        'strip-ansi': '6.0.1',
      });
    });

    it('unpins the transitive side of an unmet peer so npm can nest it', () => {
      install('node_modules/a', { name: 'a', version: '1.0.0', dependencies: { r: '^1', q: '^1' } });
      install('node_modules/r', {
        name: 'r',
        version: '1.0.0',
        peerDependencies: { q: '^2', opt: '^2' },
        peerDependenciesMeta: { opt: { optional: true } },
      });
      install('node_modules/q', { name: 'q', version: '1.4.0' });
      install('node_modules/b', { name: 'b', version: '1.0.0', peerDependencies: { q: '^1' } });
      install('node_modules/opt', { name: 'opt', version: '1.0.0' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1', b: '^1', opt: '^1' } }));
      expect(result.dependencies).to.deep.equal({ a: '1.0.0', b: '1.0.0', opt: '1.0.0', q: '1.4.0' });
    });

    it('unpins a transitive peer target that a direct dependency rejects', () => {
      install('node_modules/r', { name: 'r', version: '1.0.0', peerDependencies: { q: '^2' } });
      install('node_modules/a', { name: 'a', version: '1.0.0', dependencies: { q: '^1' } });
      install('node_modules/q', { name: 'q', version: '1.4.0' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1', r: '^1' } }));
      expect(result.dependencies).to.deep.equal({ a: '1.0.0', r: '1.0.0' });
    });

    it('treats a package in both dependencies and optionalDependencies as optional', () => {
      install('node_modules/a', {
        name: 'a',
        version: '1.0.0',
        dependencies: { native: '^1' },
        optionalDependencies: { native: '^1' },
      });
      install('node_modules/native', { name: 'native', version: '1.0.0' });
      const result = pinInstalledDependencies(root, pJson({ dependencies: { a: '^1' } }));
      expect(result.dependencies).to.deep.equal({ a: '1.0.0' });
    });

    it('throws when a dependency is not installed', () => {
      expect(() => pinInstalledDependencies(root, pJson({ dependencies: { missing: '^1' } })))
        .to.throw()
        .with.property('name', 'DependencyNotInstalled');
    });
  });
});
