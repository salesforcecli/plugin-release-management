/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup.js';
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
