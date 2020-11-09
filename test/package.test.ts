/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { expect } from 'chai';
import { fs } from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import * as sinon from 'sinon';
import { stubMethod } from '@salesforce/ts-sinon';
import { Package } from '../src/package';

const $$ = testSetup();
const pkgName = '@salesforce/my-plugin';

describe('Package', () => {
  describe('readProjectJson', () => {
    let readStub: sinon.SinonStub;

    beforeEach(() => {
      readStub = $$.SANDBOX.stub(fs, 'readJson').returns(
        Promise.resolve({
          name: pkgName,
          version: '1.0.0',
        })
      );
    });

    it('should read the package.json in the current working directory', async () => {
      const pkg = await Package.create();
      const pJson = await pkg.readProjectJson();
      expect(pJson).to.deep.equal({
        name: pkgName,
        version: '1.0.0',
      });
      expect(readStub.firstCall.calledWith('package.json')).be.true;
    });

    it('should read the package.json in the package location', async () => {
      const packageDir = path.join('my', 'project', 'dir');
      const pkg = await Package.create(packageDir);
      const pJson = await pkg.readProjectJson();
      expect(pJson).to.deep.equal({
        name: pkgName,
        version: '1.0.0',
      });
      expect(readStub.firstCall.calledWith(path.join(packageDir, 'package.json'))).be.true;
    });
  });

  describe('validateNextVersion', () => {
    beforeEach(() => {
      stubMethod($$.SANDBOX, Package.prototype, 'readProjectJson').returns(
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
      stubMethod($$.SANDBOX, Package.prototype, 'readProjectJson').returns(
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
      stubMethod($$.SANDBOX, Package.prototype, 'readProjectJson').returns(
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
});
