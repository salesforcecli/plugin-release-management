/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as shelljs from 'shelljs';
import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod, stubInterface } from '@salesforce/ts-sinon';
import * as sinon from 'sinon';
import { Ux } from '@salesforce/sf-plugins-core';
import { Package } from '../src/package';
import { PackageRepo } from '../src/repository';

const $$ = testSetup();
const pkgName = '@salesforce/my-plugin';

describe('PackageRepo', () => {
  let uxStub: Ux;
  let execStub: sinon.SinonStub;

  beforeEach(async () => {
    uxStub = stubInterface<Ux>($$.SANDBOX, {}) as unknown as Ux;
  });

  describe('isReleasable', () => {
    function buildCommitLog(...commitTypes: string[]): string {
      const commitHash = '2b5efa1bed4934a9f5e3d1b8ed4c411ff4121261';
      let final = '';
      for (const type of commitTypes) {
        final += `${type}: made some changes${os.EOL}${os.EOL}-hash-${os.EOL}${commitHash}${os.EOL}SPLIT${os.EOL}`;
      }
      return final;
    }

    beforeEach(async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['1.0.0'],
      });
    });

    it('should be published if version was manually bumped', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '2.0.0' })
      );
      stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand')
        .withArgs(sinon.match('standard-version'), true)
        .returns('1.0.0 to 1.1.0')
        .withArgs(sinon.match('git tag'), true)
        .returns({ stdout: 'v1.0.0' })
        .withArgs(sinon.match('git log'), true)
        .returns({ stdout: buildCommitLog('chore', 'chore') });
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.shouldBePublished).to.be.true;
    });

    it('should be published if any commit indicates a major bump', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );

      stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand')
        .withArgs(sinon.match('standard-version'), true)
        .returns('1.0.0 to 1.1.0');
      stubMethod($$.SANDBOX, shelljs, 'exec')
        .withArgs(sinon.match('npm config'))
        .returns({ stdout: 'https://registry.npmjs.org/' })
        .withArgs(sinon.match('git tag'), { silent: true })
        .returns({ stdout: 'v1.0.0' })
        .withArgs(sinon.match('git log'), { silent: true })
        .returns({ stdout: buildCommitLog('feat!', 'chore') });
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.shouldBePublished).to.be.true;
    });

    it('should be published if any commit indicates a minor bump', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );

      stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand')
        .withArgs(sinon.match('standard-version'), true)
        .returns('1.0.0 to 1.1.0');
      stubMethod($$.SANDBOX, shelljs, 'exec')
        .withArgs(sinon.match('npm config'))
        .returns({ stdout: 'https://registry.npmjs.org/' })
        .withArgs(sinon.match('git tag'), { silent: true })
        .returns({ stdout: 'v1.0.0' })
        .withArgs(sinon.match('git log'), { silent: true })
        .returns({ stdout: buildCommitLog('feat', 'chore') });
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.shouldBePublished).to.be.true;
    });

    it('should be published if any commit indicates a patch bump', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );

      stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand')
        .withArgs(sinon.match('standard-version'), true)
        .returns('1.0.0 to 1.1.0');
      stubMethod($$.SANDBOX, shelljs, 'exec')
        .withArgs(sinon.match('npm config'))
        .returns({ stdout: 'https://registry.npmjs.org/' })
        .withArgs(sinon.match('git tag'), { silent: true })
        .returns({ stdout: 'v1.0.0' })
        .withArgs(sinon.match('git log'), { silent: true })
        .returns({ stdout: buildCommitLog('fix', 'chore') });
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.shouldBePublished).to.be.true;
    });

    it('should not be published if no commit indicates a major, minor, or patch bump', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );

      stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand')
        .withArgs(sinon.match('standard-version'), true)
        .returns('1.0.0 to 1.1.0');
      stubMethod($$.SANDBOX, shelljs, 'exec')
        .withArgs(sinon.match('npm config'))
        .returns({ stdout: 'https://registry.npmjs.org/' })
        .withArgs(sinon.match('git tag'), { silent: true })
        .returns({ stdout: 'v1.0.0' })
        .withArgs(sinon.match('git log'), { silent: true })
        .returns({ stdout: buildCommitLog('chore', 'docs', 'style', 'test', 'ci') });
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.shouldBePublished).to.be.false;
    });
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
      stubMethod($$.SANDBOX, PackageRepo.prototype, 'isReleasable').returns(true);
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0');
      const repo = await PackageRepo.create({ ux: uxStub });
      expect(repo.nextVersion).to.equal('1.1.0');
    });

    it('should use standard-version to determine a prerelease version', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );
      stubMethod($$.SANDBOX, PackageRepo.prototype, 'isReleasable').returns(true);
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0-0');
      const repo = await PackageRepo.create({ ux: uxStub, useprerelease: '' });
      expect(repo.nextVersion).to.equal('1.1.0-0');
      expect(execStub.args[0][0]).to.include('--prerelease');
    });

    it('should use standard-version to determine a specific prerelease version', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.0.0' })
      );
      stubMethod($$.SANDBOX, PackageRepo.prototype, 'isReleasable').returns(true);
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('1.0.0 to 1.1.0-beta.0');
      const repo = await PackageRepo.create({ ux: uxStub, useprerelease: 'beta' });
      expect(repo.nextVersion).to.equal('1.1.0-beta.0');
      expect(execStub.args[0][0]).to.include('--prerelease');
    });
  });

  describe('validate', () => {
    it('should validate that next version is valid', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.1.0' })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['1.0.0'],
      });
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('');

      const repo = await PackageRepo.create({ ux: uxStub });
      repo.package.setNextVersion('2.0.0');
      const validation = repo.validate();
      expect(validation).to.deep.equal({
        nextVersion: '2.0.0',
        currentVersion: '1.0.0',
        valid: true,
        name: pkgName,
      });
    });

    it('should invalidate the next version when it already exists', async () => {
      stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(
        Promise.resolve({ name: pkgName, version: '1.1.0' })
      );
      stubMethod($$.SANDBOX, Package.prototype, 'retrieveNpmPackage').returns({
        name: pkgName,
        version: '1.0.0',
        versions: ['1.0.0'],
      });
      execStub = stubMethod($$.SANDBOX, PackageRepo.prototype, 'execCommand').returns('');

      const repo = await PackageRepo.create({ ux: uxStub });
      repo.package.setNextVersion('1.0.0');
      const validation = repo.validate();
      expect(validation).to.deep.equal({
        nextVersion: '1.0.0',
        currentVersion: '1.0.0',
        valid: false,
        name: pkgName,
      });
    });
  });

  describe('prepare', () => {
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
    });

    it('should run standard-version command with --dry-run when the dryrun option is provided', async () => {
      const repo = await PackageRepo.create({ ux: uxStub });
      repo.prepare({ dryrun: true });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('--dry-run');
    });

    it('should run standard-version command without --dry-run when the dryrun option is not provided', async () => {
      const repo = await PackageRepo.create({ ux: uxStub });
      repo.prepare();
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.not.include('--dry-run');
    });

    it('should use the this.nextVersion as the value for the --release-as flag', async () => {
      stubMethod($$.SANDBOX, PackageRepo.prototype, 'determineNextVersion').returns('2.0.0');
      const repo = await PackageRepo.create({ ux: uxStub });
      repo.prepare({ dryrun: true });
      const cmd = execStub.firstCall.args[0];
      expect(cmd).to.include('--release-as 2.0.0');
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
