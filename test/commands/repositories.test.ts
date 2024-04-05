/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
