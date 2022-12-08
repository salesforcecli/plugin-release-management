/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs';
import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import * as sinon from 'sinon';
import { stubMethod } from '@salesforce/ts-sinon';
import { Package } from '../src/package';

const $$ = testSetup();
const pkgName = '@salesforce/my-plugin';

describe('Package', () => {
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

  describe('validateNextVersion', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
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

    it('should validate that next version is valid', async () => {
      const pkg = await Package.create();
      pkg.setNextVersion('1.1.0');
      const validation = pkg.validateNextVersion();
      expect(validation).to.deep.equal({
        nextVersion: '1.1.0',
        currentVersion: '1.0.0',
        valid: true,
        name: pkgName,
      });
    });

    it('should invalidate that next version when it already exists', async () => {
      const pkg = await Package.create();
      pkg.setNextVersion('1.0.0');
      const validation = pkg.validateNextVersion();
      expect(validation).to.deep.equal({
        nextVersion: '1.0.0',
        currentVersion: '1.0.0',
        valid: false,
        name: pkgName,
      });
    });
  });

  describe('get/set nextVersion', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({
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

    it('should set and get the next version', async () => {
      const pkg = await Package.create();
      pkg.setNextVersion('1.1.0');
      expect(pkg.getNextVersion()).to.equal('1.1.0');
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

    it('should return false if the next version is not listed yet', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['0.0.1', '0.0.5', '1.0.0'],
      });
      const pkg = await Package.create();
      pkg.setNextVersion('1.1.0');
      expect(pkg.nextVersionIsAvailable()).to.equal(false);
    });

    it('should return true if the next version is listed', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.1.0',
        versions: ['0.0.1', '0.0.5', '1.0.0', '1.1.0'],
      });
      const pkg = await Package.create();
      pkg.setNextVersion('1.1.0');
      expect(pkg.nextVersionIsAvailable()).to.equal(true);
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
        })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'getDistTags').returns({
        latest: '9.9.9',
      });
    });

    it('should look up latest version if not provided', async () => {
      const pkg = await Package.create();
      const results = pkg.bumpDependencyVersions(['@sf/info', '@salesforce/plugin-config']);

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

      expect(pkg.packageJson.resolutions['@salesforce/source-deploy-retrieve']).to.equal('1.0.1');
    });
  });

  describe.only('getVersionsForTag', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'getDistTags').returns({
        latest: '1.2.3',
        dev: '1.2.3-beta.0',
      });
    });

    it('bumps minor from dist tag', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('latest');

      expect(results).to.deep.equal(['1.2.3', '1.3.0']);
    });

    it('bumps patch from dist tag', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('latest', true);

      expect(results).to.deep.equal(['1.2.3', '1.2.4']);
    });

    it('bumps prerelease from dist tag', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('dev');

      expect(results).to.deep.equal(['1.2.3-beta.0', '1.2.3-beta.1']);
    });

    it('throws an error for invalid tag', async () => {
      const pkg = await Package.create();

      try {
        pkg.getVersionsForTag('foo');
      } catch (err) {
        expect(err.message).to.deep.equal("Unable to parse valid semver from 'foo'");
      }
    });

    it('bumps minor from semver', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('4.5.6');

      expect(results).to.deep.equal(['4.5.6', '4.6.0']);
    });

    it('bumps patch from semver', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('4.5.6', true);

      expect(results).to.deep.equal(['4.5.6', '4.5.7']);
    });

    it('bumps prerelease from semver', async () => {
      const pkg = await Package.create();
      const results = pkg.getVersionsForTag('4.5.6-alpha.0');

      expect(results).to.deep.equal(['4.5.6-alpha.0', '4.5.6-alpha.1']);
    });

    it('throws an error for invalid semver', async () => {
      const pkg = await Package.create();

      try {
        pkg.getVersionsForTag('1.a.3');
      } catch (err) {
        expect(err.message).to.deep.equal("Unable to parse valid semver from '1.a.3'");
      }
    });
  });
});
