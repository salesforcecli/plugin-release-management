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
