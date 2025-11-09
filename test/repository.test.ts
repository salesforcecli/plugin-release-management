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

import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod, stubInterface } from '@salesforce/ts-sinon';
import sinon from 'sinon';
import { Ux } from '@salesforce/sf-plugins-core';
import { Package } from '../src/package.js';
import { PackageRepo } from '../src/repository.js';

const pkgName = '@salesforce/my-plugin';

describe('PackageRepo', () => {
  const $$ = new TestContext();
  let uxStub: Ux;
  let execStub: sinon.SinonStub;

  beforeEach(async () => {
    uxStub = stubInterface<Ux>($$.SANDBOX, {}) as unknown as Ux;
  });

  describe('determineNextVersion', () => {
    beforeEach(async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['1.0.0'],
      });
    });

    it('should use the version in package.json if that version does not exist in the registry', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '2.0.0' })
      );
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('');
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.nextVersion).to.equal('2.0.0');
    });

    it('should use standard-version to determine the next version if the version in the package.json already exists', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0');
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.nextVersion).to.equal('1.1.0');
    });

    it('should use standard-version to determine a prerelease version', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0-0');
      const repo = await PackageRepo.create({ ux: uxStub, useprerelease: '' });
      expect(repo.nextVersion).to.equal('1.1.0-0');
      expect(execStub.args[0][0]).to.include('--prerelease');
    });

    it('should use standard-version to determine a specific prerelease version', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0-beta.0');
      const repo = await PackageRepo.create({ ux: uxStub, useprerelease: 'beta' });
      expect(repo.nextVersion).to.equal('1.1.0-beta.0');
      expect(execStub.args[0][0]).to.include('--prerelease');
    });
  });

  describe('publish', () => {
    let repo: PackageRepo;

    beforeEach(async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.1.0' })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['1.0.0'],
      });
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('');
      process.env.NPM_TOKEN = 'FOOBARBAZ';
      repo = await PackageRepo.create({ ux: uxStub });
    });

    afterEach(() => {
      delete process.env.NPM_TOKEN;
    });

    it('should use the --dry-run flag when the dryrun option is provided', async () => {
      await repo.publish({ dryrun: true });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('--dry-run');
    });

    it('should not use the --dry-run flag when the dryrun option is not provided', async () => {
      await repo.publish();
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.not.include('--dry-run');
    });

    it('should publish the tarfile when a signature is provided in the options', async () => {
      await repo.publish({
        dryrun: true,
        signatures: [
          {
            fileTarPath: 'tarfile.tar',
            packageVersion: '1.1.0',
            packageName: pkgName,
            publicKeyContents: 'blah',
            signatureContents: 'blah',
            packageJsonSfdxProperty: {
              publicKeyUrl: 'blah',
              signatureUrl: 'blah',
            },
          },
        ],
      });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('tarfile.tar');
    });

    it('should publish the package with the specified tag', async () => {
      await repo.publish({
        dryrun: true,
        tag: 'test',
      });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('--tag test');
    });

    it('should publish the package with the specified access level', async () => {
      await repo.publish({
        dryrun: true,
        access: 'restricted',
      });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('--access restricted');
    });
  });
});
