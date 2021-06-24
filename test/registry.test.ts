/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as path from 'path';
import { expect } from '@salesforce/command/lib/test';
import { fs } from '@salesforce/core';
import { shouldThrow, testSetup } from '@salesforce/core/lib/testSetup';
import { Env } from '@salesforce/kit';
import { Registry } from '../src/registry';

const $$ = testSetup();

describe('registry tests', () => {
  it('should represent defaults', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(undefined);
    const registry = new Registry();
    expect(registry).to.be.ok;
    expect(registry.registryUrl).to.include('https://registry');
    expect(registry.getRegistryParameter()).to.be.include('--registry https://registry');
  });
  it('should represent registry https://foo.bar.baz.org', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(undefined);
    const registry = new Registry('https://foo.bar.baz.org');
    expect(registry).to.be.ok;
    expect(registry.registryUrl).to.be.equal('https://foo.bar.baz.org');
    expect(registry.getRegistryParameter()).to.be.equal('--registry https://foo.bar.baz.org');
  });
  it('should pickup registry from env var', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns('https://foo.bar.baz.org');
    const registry = new Registry();
    expect(registry).to.be.ok;
    expect(registry.registryUrl).to.be.equal('https://foo.bar.baz.org');
    expect(registry.getRegistryParameter()).to.be.equal('--registry https://foo.bar.baz.org');
  });
});
describe('npmrc tests', () => {
  let packageDir;
  before(() => {
    packageDir = path.join(os.tmpdir(), new Date().getMilliseconds().toString());
    fs.mkdirpSync(packageDir);
  });
  afterEach(() => {
    if (fs.fileExistsSync(path.join(packageDir, '.npmrc'))) {
      fs.unlinkSync(path.join(packageDir, '.npmrc'));
    }
  });
  after(async () => {
    await fs.remove(packageDir);
  });
  it('should NOT WRITE npmrc registry for registry defaults', async () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(undefined);
    const registry = new Registry();
    await registry.setNpmRegistry(packageDir);
    expect(fs.fileExistsSync(path.join(packageDir, '.npmrc'))).to.be.false;
  });
  it('should WRITE npmrc registry for registry not equal to default', async () => {
    const registry = new Registry('https://foo.bar.baz.org');
    await registry.setNpmRegistry(packageDir);
    expect(fs.fileExistsSync(path.join(packageDir, '.npmrc'))).to.be.true;
  });
  it('should throw error when setting auth token when token not present', async () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(undefined);
    const registry = new Registry();
    try {
      await shouldThrow(registry.setNpmAuth(packageDir));
    } catch (e) {
      expect(e).to.have.property('message', 'auth token has not been set');
    }
  });
  it('should write token from constructor when NPM_TOKEN is not set', async () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(undefined);
    const registry = new Registry(undefined, 'foobarbaz');
    await registry.setNpmAuth(packageDir);
    const npmrc = await registry.readNpmrc(packageDir);
    expect(npmrc).to.have.lengthOf(2);
    expect(npmrc[0]).to.be.include(':_authToken="foobarbaz"');
    expect(npmrc[0]).to.be.include('registry');
  });
  it('should write token from NPM_TOKEN when constructor token not set', async () => {
    const stub = $$.SANDBOX.stub(Env.prototype, 'getString');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    stub.withArgs('NPM_TOKEN').returns('foobarbazfoobarbaz');
    const registry = new Registry();
    await registry.setNpmAuth(packageDir);
    const npmrc = await registry.readNpmrc(packageDir);
    expect(npmrc).to.have.lengthOf(2);
    expect(npmrc[0]).to.be.include(':_authToken="foobarbazfoobarbaz"');
    expect(npmrc[0]).to.be.include('registry');
  });
  it('should write token from NPM_TOKEN with private registry and undefined token in constructor', async () => {
    const stub = $$.SANDBOX.stub(Env.prototype, 'getString');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    stub.withArgs('NPM_TOKEN').returns('foobarbazfoobarbaz');
    const registry = new Registry('https://foo.bar.baz.org');
    await registry.setNpmAuth(packageDir);
    const npmrc = await registry.readNpmrc(packageDir);
    expect(npmrc).to.have.lengthOf(2);
    expect(npmrc[0]).to.be.include(':_authToken="foobarbazfoobarbaz"');
    expect(npmrc[0]).to.be.include('foo.bar.baz.org');
  });
});
