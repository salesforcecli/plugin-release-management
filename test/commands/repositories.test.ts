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

import sinon from 'sinon';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { stubMethod, fromStub, stubInterface } from '@salesforce/ts-sinon';
import got from 'got';
import Repositories from '../../src/commands/repositories/index.js';

describe('repositories', () => {
  const sandbox = sinon.createSandbox();

  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));
  oclifConfigStub.runHook = async () => ({ successes: [], failures: [] });

  class TestRepositories extends Repositories {
    public async runIt() {
      await this.init();
      return this.run();
    }
  }

  afterEach(() => {
    sandbox.restore();
  });

  it('should return a list of known slugs', async () => {
    stubMethod(sandbox, got, 'get').resolves({
      body: '[{ "url": "https://github.com/forcedotcom/sfdx-core", "packages": [{"name": "@salesforce/core"}] }]',
    });

    const cmd = new TestRepositories(['--json'], oclifConfigStub);
    const result = await cmd.runIt();

    const core = result.find((repo) => repo.name === 'sfdx-core');
    expect(core).to.have.property('organization').and.equals('forcedotcom');
    expect(core).to.have.property('name').and.equals('sfdx-core');
    expect(core).to.have.property('url').and.contains('forcedotcom/sfdx-core');
  });
});
