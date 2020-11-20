/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import got from 'got';

describe('circleci', () => {
  test
    .do(async () => {
      $$.SANDBOX.stub(got, 'get').resolves({
        body: '[{ "url": "https://github.com/forcedotcom/sfdx-core", "packages": [{"name": "@salesforce/core"}] }]',
      });
    })
    .stdout()
    .command(['circleci', '--json'])
    .it('should return a list of known slugs', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;
      const core = result.find((slug) => slug === 'gh/forcedotcom/sfdx-core');
      expect(core).to.exist;
    });
});
