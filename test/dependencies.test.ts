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
import { Env } from '@salesforce/kit';
import { stubMethod } from '@salesforce/ts-sinon';
import { verifyDependencies } from '../src/dependencies.js';

describe('Dependencies', () => {
  const $$ = new TestContext();

  it('should pass when all required env variables exist', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns('foobar');
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(0);
    expect(validation.results).to.deep.equal([
      { name: 'AWS_ACCESS_KEY_ID', type: 'env', passed: true },
      { name: 'AWS_SECRET_ACCESS_KEY', type: 'env', passed: true },
      { name: 'NPM_TOKEN', type: 'env', passed: true },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });

  it('should pass when required env variables are NOT set', () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getString').returns(undefined);
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(3);
    expect(validation.results).to.deep.equal([
      {
        name: 'AWS_ACCESS_KEY_ID',
        type: 'env',
        passed: false,
        message: 'Set AWS_ACCESS_KEY_ID environment variable',
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        type: 'env',
        passed: false,
        message: 'Set AWS_SECRET_ACCESS_KEY environment variable',
      },
      {
        name: 'NPM_TOKEN',
        type: 'env',
        passed: false,
        message: 'Set NPM_TOKEN environment variable',
      },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });
});
