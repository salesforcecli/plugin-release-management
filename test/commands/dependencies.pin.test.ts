/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import shell from 'shelljs';
import sinon from 'sinon';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { stubMethod, fromStub, stubInterface } from '@salesforce/ts-sinon';
import Pin from '../../src/commands/npm/dependencies/pin.js';

describe('dependencies:pin', () => {
  const sandbox = sinon.createSandbox();

  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));

  oclifConfigStub.runHook = async () => ({ successes: [], failures: [] });

  class TestNpmDependenciesPin extends Pin {
    public async runIt() {
      await this.init();
      return this.run();
    }
  }

  const runNpmDependenciesPinCmd = async (params: string[]) => {
    const cmd = new TestNpmDependenciesPin(params, oclifConfigStub);
    return cmd.runIt();
  };

  afterEach(() => {
    sandbox.restore();
  });

  function setupStub(): void {
    // prevent it from writing back to the package.json
    stubMethod(sandbox, fs, 'writeFileSync');
    const pJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { '@salesforce/plugin-auth': '^1.4.0' },
      pinnedDependencies: ['@salesforce/plugin-auth'],
    };

    stubMethod(sandbox, fs.promises, 'readFile').resolves(JSON.stringify(pJson));
    // we don't need all members of what exec returns, just the stdout
    stubMethod(sandbox, shell, 'exec').returns({ stdout: '{"latest":"1.4.4","latest-rc":"1.5.0"}' });
  }

  it('should update the package.json with pinned versions for a package', async () => {
    setupStub();
    const result = await runNpmDependenciesPinCmd(['--json']);

    const expected = [
      {
        name: '@salesforce/plugin-auth',
        tag: 'latest',
        version: '1.4.4',
      },
    ];

    expect(result).to.deep.equal(expected);
  });

  it('should update the package.json with the target release version', async () => {
    setupStub();
    const result = await runNpmDependenciesPinCmd(['--tag', 'latest-rc', '--json']);

    const expected = [
      {
        name: '@salesforce/plugin-auth',
        tag: 'latest-rc',
        version: '1.5.0',
      },
    ];

    expect(result).to.deep.equal(expected);
  });
});
