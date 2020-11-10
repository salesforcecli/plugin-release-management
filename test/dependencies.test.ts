/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { Env } from '@salesforce/kit';
import * as shelljs from 'shelljs';
import { verifyDependencies } from '../src/dependencies';

const $$ = testSetup();

describe('Depedencies', () => {
  it('should pass when all required env variables and bin scripts exist', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns('foobar');
    $$.SANDBOX.stub(shelljs, 'which').returns('foobar' as shelljs.ShellString);
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(0);
    expect(validation.results).to.deep.equal([
      { name: 'sfdx-trust', type: 'bin', passed: true },
      { name: 'AWS_ACCESS_KEY_ID', type: 'env', passed: true },
      { name: 'AWS_SECRET_ACCESS_KEY', type: 'env', passed: true },
      { name: 'SALESFORCE_KEY', type: 'env', passed: true },
      { name: 'NPM_TOKEN', type: 'env', passed: true },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });

  it('should pass when required env variables are NOT set', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(null);
    $$.SANDBOX.stub(shelljs, 'which').returns('foobar' as shelljs.ShellString);
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(4);
    expect(validation.results).to.deep.equal([
      { name: 'sfdx-trust', type: 'bin', passed: true },
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
        name: 'SALESFORCE_KEY',
        type: 'env',
        passed: false,
        message: 'Set SALESFORCE_KEY environment variable',
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

  it('should pass when required bin scripts do not exist', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns('foobar');
    $$.SANDBOX.stub(shelljs, 'which').returns(null as shelljs.ShellString);
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(1);
    expect(validation.results).to.deep.equal([
      {
        message: 'Install sfdx-trust',
        name: 'sfdx-trust',
        type: 'bin',
        passed: false,
      },
      { name: 'AWS_ACCESS_KEY_ID', type: 'env', passed: true },
      { name: 'AWS_SECRET_ACCESS_KEY', type: 'env', passed: true },
      { name: 'SALESFORCE_KEY', type: 'env', passed: true },
      { name: 'NPM_TOKEN', type: 'env', passed: true },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });
});
