/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { stubMethod, fromStub, stubInterface } from '@salesforce/ts-sinon';
import got from 'got';
import CircleCI from '../../src/commands/circleci/index';

describe('circleci', () => {
  const sandbox = sinon.createSandbox();

  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));

  class TestCircleCI extends CircleCI {
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

    const cmd = new TestCircleCI(['--json'], oclifConfigStub);
    const result = await cmd.runIt();

    const core = result.find((slug) => slug === 'gh/forcedotcom/sfdx-core');
    expect(core).to.exist;
  });
});
