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
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { shouldThrow, TestContext } from '@salesforce/core/testSetup';

import { Env } from '@salesforce/kit';
import { stubMethod } from '@salesforce/ts-sinon';
import { Registry } from '../src/registry.js';

describe('src/registry', () => {
  const $$ = new TestContext();

  describe('registry tests', () => {
    it('should represent defaults', () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
      const registry = new Registry();
      expect(registry).to.be.ok;
      expect(registry.registryUrl).to.include('https://registry');
      expect(registry.getRegistryParameter()).to.be.include('--registry https://registry');
    });
    it('should represent registry https://foo.bar.baz.org', () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
      const registry = new Registry('https://foo.bar.baz.org');
      expect(registry).to.be.ok;
      expect(registry.registryUrl).to.be.equal('https://foo.bar.baz.org');
      expect(registry.getRegistryParameter()).to.be.equal('--registry https://foo.bar.baz.org');
    });
    it('should pickup registry from env var', () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns('https://foo.bar.baz.org');
      const registry = new Registry();
      expect(registry).to.be.ok;
      expect(registry.registryUrl).to.be.equal('https://foo.bar.baz.org');
      expect(registry.getRegistryParameter()).to.be.equal('--registry https://foo.bar.baz.org');
    });
  });
  describe('npmrc tests', () => {
    let packageDir = path.join(os.tmpdir(), new Date().getMilliseconds().toString());
    beforeEach(() => {
      packageDir = path.join(os.tmpdir(), new Date().getMilliseconds().toString());
      fs.mkdirSync(packageDir, { recursive: true });
    });
    afterEach(() => {
      if (packageDir) {
        fs.rmSync(packageDir, { recursive: true });
      }
    });
    it('should NOT WRITE npmrc registry for registry defaults', async () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
      const registry = new Registry();
      await registry.setNpmRegistry(packageDir);
      expect(fs.existsSync(path.join(packageDir, '.npmrc'))).to.be.false;
    });
    it('should WRITE npmrc registry for registry not equal to default', async () => {
      const registry = new Registry('https://foo.bar.baz.org');
      await registry.setNpmRegistry(packageDir);
      expect(fs.existsSync(path.join(packageDir, '.npmrc'))).to.be.true;
    });
    it('should throw error when setting auth token when token not present', async () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
      const registry = new Registry();
      try {
        await shouldThrow(registry.setNpmAuth(packageDir));
      } catch (e) {
        expect(e).to.have.property('message', 'auth token has not been set');
      }
    });
    it('should write token from constructor when NPM_TOKEN is not set', async () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
      const registry = new Registry(undefined, 'foobarbaz');
      await registry.setNpmAuth(packageDir);
      const npmrc = await registry.readNpmrc(packageDir);
      expect(npmrc).to.have.lengthOf(2);
      expect(npmrc[0]).to.be.include(':_authToken="foobarbaz"');
      expect(npmrc[0]).to.be.include('registry');
    });
    it('should write token from NPM_TOKEN when constructor token not set', async () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').withArgs('NPM_TOKEN').returns('foobarbazfoobarbaz');
      const registry = new Registry();
      await registry.setNpmAuth(packageDir);
      const npmrc = await registry.readNpmrc(packageDir);
      expect(npmrc).to.have.lengthOf(2);
      expect(npmrc[0]).to.be.include(':_authToken="foobarbazfoobarbaz"');
      expect(npmrc[0]).to.be.include('registry');
    });
    it('should write token from NPM_TOKEN with private registry and undefined token in constructor', async () => {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').withArgs('NPM_TOKEN').returns('foobarbazfoobarbaz');
      const registry = new Registry('https://foo.bar.baz.org');
      await registry.setNpmAuth(packageDir);
      const npmrc = await registry.readNpmrc(packageDir);
      expect(npmrc).to.have.lengthOf(2);
      expect(npmrc[0]).to.be.include(':_authToken="foobarbazfoobarbaz"');
      expect(npmrc[0]).to.be.include('foo.bar.baz.org');
    });
  });
});
