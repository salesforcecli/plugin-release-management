/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as nativeFs from 'fs';
import { $$, expect, test } from '@salesforce/command/lib/test';
import * as shell from 'shelljs';

function setupStub(alias?: string): void {
  // prevent it from writing back to the package.json
  $$.SANDBOX.stub(nativeFs, 'writeFileSync');
  const pJson = alias
    ? {
        name: 'test',
        version: '1.0.0',
        dependencies: { [alias]: 'npm:@salesforce/plugin-auth@^1.4.0' },
        pinnedDependencies: [alias],
      }
    : {
        name: 'test',
        version: '1.0.0',
        dependencies: { '@salesforce/plugin-auth': '^1.4.0' },
        pinnedDependencies: ['@salesforce/plugin-auth'],
      };
  $$.SANDBOX.stub(nativeFs.promises, 'readFile').resolves(JSON.stringify(pJson));
  // we don't need all members of what exec returns, just the stdout
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  $$.SANDBOX.stub(shell, 'exec').returns({ stdout: '{"latest":"1.4.4","latest-rc":"1.5.0"}' });
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
          alias: null,
        },
      ];

      const result = JSON.parse(ctx.stdout).result;
      expect(result).to.deep.equal(expected);
    });

  test
    .do(() => {
      setupStub('auth');
    })
    .stdout()
    .command(['npm:dependencies:pin', '--json'])
    .it('should update the package.json with pinned versions for an aliased package', (ctx) => {
      const expected = [
        {
          name: '@salesforce/plugin-auth',
          tag: 'latest',
          version: '1.4.4',
          alias: 'auth',
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
    .command(['npm:dependencies:pin', '--tag', 'latest-rc', '--json'])
    .it('should update the package.json with the target release version', (ctx) => {
      const expected = [
        {
          name: '@salesforce/plugin-auth',
          tag: 'latest-rc',
          version: '1.5.0',
          alias: null,
        },
      ];

      const result = JSON.parse(ctx.stdout).result;
      expect(result).to.deep.equal(expected);
    });
});
