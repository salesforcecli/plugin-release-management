/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import * as shell from 'shelljs';
import { fs } from '@salesforce/core';

function setupStub(): void {
  // prevent it from writing back to the package.json
  $$.SANDBOX.stub(fs, 'writeJsonSync');
  $$.SANDBOX.stub(fs, 'readJson').resolves({
    name: 'test',
    version: '1.0.0',
    dependencies: { '@salesforce/plugin-auth': '^1.4.0' },
    pinnedDependencies: ['@salesforce/plugin-auth'],
  });
  // we don't need all members of what exec returns, just the stdout
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  $$.SANDBOX.stub(shell, 'exec').returns({ stdout: '{"latest":"1.4.4","test":"0.0.6"}' });
}

describe('dependencies:pin', () => {
  test
    .do(() => {
      setupStub();
    })
    .stdout()
    .command(['npm:dependencies:pin', '--json'])
    .it('should update the package.json with pinned versions for a package', (ctx) => {
      const expected = [
        {
          name: '@salesforce/plugin-auth',
          tag: 'latest',
          version: '1.4.4',
        },
      ];

      const result = JSON.parse(ctx.stdout).result;
      expect(result).to.deep.equal(expected);
    });

  test
    .do(async () => {
      setupStub();
    })
    .stdout()
    .command(['npm:dependencies:pin', '--tag', 'test', '--json'])
    .it('should update the package.json with the target release version', (ctx) => {
      const expected = [
        {
          name: '@salesforce/plugin-auth',
          tag: 'test',
          version: '0.0.6',
        },
      ];

      const result = JSON.parse(ctx.stdout).result;
      expect(result).to.deep.equal(expected);
    });
});
