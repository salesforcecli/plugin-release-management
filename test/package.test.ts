/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import { assert, expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup.js';
import sinon from 'sinon';
import { stubMethod } from '@salesforce/ts-sinon';
import { Package } from '../src/package.js';

const pkgName = '@salesforce/my-plugin';

describe('Package', () => {
  const $$ = new TestContext();
  describe('readPackageJson', () => {
    let readStub: sinon.SinonStub;

    beforeEach(() => {
      readStub = $$.SANDBOX.stub(fs.promises, 'readFile').resolves(
        JSON.stringify({
          name: pkgName,
          version: '1.0.0',
        })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['0.0.1', '0.0.5', '1.0.0'],
      });
    });
    afterEach(() => {
      $$.restore();
    });

    it('should read the package.json in the current working directory', async () => {
      const pkg = await Package.create();
      const pJson = await pkg.readPackageJson();
      expect(pJson).to.deep.equal({
        name: pkgName,
        version: '1.0.0',
      });
      expect(readStub.firstCall.firstArg.endsWith('package.json')).be.true;
    });

    it('should read the package.json in the package location', async () => {
      const packageDir = path.join('my', 'project', 'dir');
      const pkg = await Package.create({ location: packageDir });
      const pJson = await pkg.readPackageJson();
      expect(pJson).to.deep.equal({
        name: pkgName,
        version: '1.0.0',
      });
      expect(readStub.firstCall.calledWith(path.join(packageDir, 'package.json'))).be.true;
    });
  });

  describe('nextVersionIsAvailable', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
        })
      );
    });
    afterEach(() => {
      $$.restore();
    });
    it('should return false if the next version is not listed yet', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['0.0.1', '0.0.5', '1.0.0'],
      });
      const pkg = await Package.create();
      expect(pkg.nextVersionIsAvailable('1.1.0')).to.equal(false);
    });

    it('should return true if the next version is listed', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.1.0',
        versions: ['0.0.1', '0.0.5', '1.0.0', '1.1.0'],
      });
      const pkg = await Package.create();
      expect(pkg.nextVersionIsAvailable('1.1.0')).to.equal(true);
    });
  });

  describe('getDependencyInfo', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
          dependencies: {
            '@sf/info': 'npm:@salesforce/plugin-info@2.0.1',
            '@salesforce/plugin-config': '1.2.3',
          },
        })
      );
    });
    afterEach(() => {
      $$.restore();
    });
    it('should find dependency using an npm alias', async () => {
      const pkg = await Package.create();
      const deps = pkg.packageJson.dependencies;
      const dependency = pkg.getDependencyInfo('@sf/info', deps);

      expect(dependency).to.deep.equal({
        dependencyName: '@sf/info',
        packageName: '@salesforce/plugin-info',
        alias: 'npm:@salesforce/plugin-info@2.0.1',
        currentVersion: '2.0.1',
      });
    });

    it('should find an npm alias with a package name', async () => {
      const pkg = await Package.create();
      const deps = pkg.packageJson.dependencies;
      const dependency = pkg.getDependencyInfo('@salesforce/plugin-info', deps);

      expect(dependency).to.deep.equal({
        dependencyName: '@sf/info',
        packageName: '@salesforce/plugin-info',
        alias: 'npm:@salesforce/plugin-info@2.0.1',
        currentVersion: '2.0.1',
      });
    });

    it('should find a dependency using a package name', async () => {
      const pkg = await Package.create();
      const deps = pkg.packageJson.dependencies;
      const dependency = pkg.getDependencyInfo('@salesforce/plugin-config', deps);

      expect(dependency).to.deep.equal({
        dependencyName: '@salesforce/plugin-config',
        packageName: '@salesforce/plugin-config',
        alias: null,
        currentVersion: '1.2.3',
      });
    });
  });

  describe('bumpDependencyVersions', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
          dependencies: {
            '@sf/info': 'npm:@salesforce/plugin-info@2.0.1',
            '@salesforce/plugin-config': '1.2.3',
            'left-pad': '1.1.1',
          },
          resolutions: {
            '@salesforce/source-deploy-retrieve': '1.0.0',
          },
          oclif: {
            jitPlugins: {
              '@salesforce/jit-me': '1.0.0',
            },
          },
        })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'getDistTags').returns({
        latest: '9.9.9',
      });
    });
    afterEach(() => {
      $$.restore();
    });
    it('should look up latest version if not provided', async () => {
      const pkg = await Package.create();
      const results = pkg.bumpDependencyVersions(['@sf/info', '@salesforce/plugin-config', '@salesforce/jit-me']);

      expect(results).to.deep.equal([
        {
          dependencyName: '@sf/info',
          packageName: '@salesforce/plugin-info',
          alias: 'npm:@salesforce/plugin-info@2.0.1',
          currentVersion: '2.0.1',
          finalVersion: 'npm:@salesforce/plugin-info@9.9.9',
        },
        {
          dependencyName: '@salesforce/plugin-config',
          packageName: '@salesforce/plugin-config',
          alias: null,
          currentVersion: '1.2.3',
          finalVersion: '9.9.9',
        },
        {
          dependencyName: '@salesforce/jit-me',
          packageName: '@salesforce/jit-me',
          alias: null,
          currentVersion: '1.0.0',
          finalVersion: '9.9.9',
        },
      ]);
    });

    it('should used passed in version', async () => {
      const pkg = await Package.create();
      const results = pkg.bumpDependencyVersions(['@salesforce/plugin-info@7.7.7']);

      expect(results).to.deep.equal([
        {
          dependencyName: '@sf/info',
          packageName: '@salesforce/plugin-info',
          alias: 'npm:@salesforce/plugin-info@2.0.1',
          currentVersion: '2.0.1',
          finalVersion: 'npm:@salesforce/plugin-info@7.7.7',
        },
      ]);
    });

    it('should work with non-namespaced package', async () => {
      const pkg = await Package.create();
      const results = pkg.bumpDependencyVersions(['left-pad']);

      expect(results).to.deep.equal([
        {
          dependencyName: 'left-pad',
          packageName: 'left-pad',
          alias: null,
          currentVersion: '1.1.1',
          finalVersion: '9.9.9',
        },
      ]);
    });

    it('should return an empty array if all versions are already up to date', async () => {
      const pkg = await Package.create();
      const results = pkg.bumpDependencyVersions(['@sf/info@2.0.1', '@salesforce/plugin-config@1.2.3']);

      expect(results).to.deep.equal([]);
    });

    it('should update dependencies in package.json', async () => {
      const pkg = await Package.create();
      pkg.bumpDependencyVersions(['@sf/info@2.2.2', '@salesforce/plugin-config@3.3.3']);

      expect(pkg.packageJson.dependencies['@sf/info']).to.equal('npm:@salesforce/plugin-info@2.2.2');
      expect(pkg.packageJson.dependencies['@salesforce/plugin-config']).to.equal('3.3.3');
    });

    it('should update resolutions in package.json', async () => {
      const pkg = await Package.create();
      pkg.bumpDependencyVersions(['@salesforce/source-deploy-retrieve@1.0.1']);
      assert(pkg.packageJson.resolutions);
      expect(pkg.packageJson.resolutions['@salesforce/source-deploy-retrieve']).to.equal('1.0.1');
    });

    it('should update jit in package.json', async () => {
      const pkg = await Package.create();
      pkg.bumpDependencyVersions(['@salesforce/jit-me@1.0.1']);
      assert(pkg.packageJson.oclif?.jitPlugins);
      expect(pkg.packageJson.oclif.jitPlugins['@salesforce/jit-me']).to.equal('1.0.1');
    });
  });

  describe('jitPlugins', () => {
    describe('happy path', () => {
      beforeEach(() => {
        stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
          Promise.resolve({
            name: pkgName,
            version: '1.0.0',
            dependencies: {
              '@sf/info': 'npm:@salesforce/plugin-info@2.0.1',
              '@salesforce/plugin-config': '1.2.3',
              'left-pad': '1.1.1',
            },
            oclif: {
              jitPlugins: {
                '@salesforce/jit-me': '1.0.0',
                '@salesforce/jit-me-too': '9.9.9',
              },
            },
          })
        );
        stubMethod($$.SANDBOX, Package.prototype, 'getDistTags').returns({
          latest: '9.9.9',
          'latest-rc': '9.9.10',
          pre: '9.9.11',
        });
      });
      it('bumps to the requested version', async () => {
        const pkg = await Package.create();
        const results = pkg.bumpJit('pre');

        expect(results).to.deep.equal([
          {
            name: '@salesforce/jit-me',
            tag: 'pre',
            alias: null,
            version: '9.9.11',
          },
          {
            name: '@salesforce/jit-me-too',
            tag: 'pre',
            alias: null,
            version: '9.9.11',
          },
        ]);
      });

      it('bumps to latest-rc by default', async () => {
        const pkg = await Package.create();
        const results = pkg.bumpJit();

        expect(results).to.deep.equal([
          {
            name: '@salesforce/jit-me',
            tag: 'latest-rc',
            alias: null,
            version: '9.9.10',
          },
          {
            name: '@salesforce/jit-me-too',
            tag: 'latest-rc',
            alias: null,
            version: '9.9.10',
          },
        ]);
      });

      it('should update dependencies in package.json', async () => {
        const pkg = await Package.create();
        pkg.bumpJit();
        assert(pkg.packageJson.oclif?.jitPlugins);
        expect(pkg.packageJson.oclif.jitPlugins['@salesforce/jit-me']).to.equal('9.9.10');
        expect(pkg.packageJson.oclif.jitPlugins['@salesforce/jit-me-too']).to.equal('9.9.10');
        // no change to other plugins
        expect(pkg.packageJson.dependencies['@sf/info']).to.equal('npm:@salesforce/plugin-info@2.0.1');
        expect(pkg.packageJson.dependencies['@salesforce/plugin-config']).to.equal('1.2.3');
      });
    });

    it('bumps to latest when latest-rc does not exist', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
          dependencies: {
            '@sf/info': 'npm:@salesforce/plugin-info@2.0.1',
            '@salesforce/plugin-config': '1.2.3',
            'left-pad': '1.1.1',
          },
          oclif: {
            jitPlugins: {
              '@salesforce/jit-me': '1.0.0',
              '@salesforce/jit-me-too': '9.9.9',
            },
          },
        })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'getDistTags').returns({
        latest: '9.9.9',
        pre: '9.9.11',
      });

      const pkg = await Package.create();
      const results = pkg.bumpJit();

      expect(results).to.deep.equal([
        {
          name: '@salesforce/jit-me',
          tag: 'latest',
          alias: null,
          version: '9.9.9',
        },
        {
          name: '@salesforce/jit-me-too',
          tag: 'latest',
          alias: null,
          version: '9.9.9',
        },
      ]);
      assert(pkg.packageJson.oclif?.jitPlugins);
      expect(pkg.packageJson.oclif.jitPlugins['@salesforce/jit-me']).to.equal('9.9.9');
      expect(pkg.packageJson.oclif.jitPlugins['@salesforce/jit-me-too']).to.equal('9.9.9');
    });

    it('returns empty when no jit', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
          dependencies: {
            '@sf/info': 'npm:@salesforce/plugin-info@2.0.1',
            '@salesforce/plugin-config': '1.2.3',
            'left-pad': '1.1.1',
          },
          oclif: {},
        })
      );

      const pkg = await Package.create();
      const results = pkg.bumpJit();

      expect(results).to.be.undefined;
      expect(pkg.packageJson.oclif?.jitPlugins).to.be.undefined;
    });

    afterEach(() => {
      $$.restore();
    });
  });

  describe('determineNextVersion', () => {
    afterEach(() => {
      $$.restore();
    });
    it('bumps minor', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.2.3' })
      );

      const pkg = await Package.create();
      const results = pkg.determineNextVersion();

      expect(results).to.deep.equal('1.3.0');
    });

    it('bumps patch', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.2.3' })
      );

      const pkg = await Package.create();
      const results = pkg.determineNextVersion(true);

      expect(results).to.deep.equal('1.2.4');
    });

    it('supports semver with v prefix', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: 'v1.2.3' })
      );

      const pkg = await Package.create();
      const results = pkg.determineNextVersion();

      expect(results).to.deep.equal('1.3.0');
    });

    it('bumps prerelease from standard version', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.2.3' })
      );

      const pkg = await Package.create();
      const results = pkg.determineNextVersion(false, 'beta');

      expect(results).to.deep.equal('1.2.4-beta.0');
    });

    it('bumps prerelease from existing prerelease', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.2.4-beta.0' })
      );

      const pkg = await Package.create();
      const results = pkg.determineNextVersion(false, 'beta');

      expect(results).to.deep.equal('1.2.4-beta.1');
    });
  });
});
