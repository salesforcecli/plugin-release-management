/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import got from 'got';

describe('repositories', () => {
  test
    .do(async () => {
      $$.SANDBOX.stub(got, 'get').resolves({
        body: '[{ "url": "https://github.com/forcedotcom/sfdx-core", "packages": [{"name": "@salesforce/core"}] }]',
      });
    })
    .stdout()
    .stderr()
    .command(['repositories', '--json'])
    .it('should return a list of known repositories', (ctx) => {
      const result = JSON.parse(ctx.stdout).result;

      const core = result.find((repo) => repo.name === 'sfdx-core');
      expect(core).to.have.property('organization').and.equals('forcedotcom');
      expect(core).to.have.property('name').and.equals('sfdx-core');
      expect(core).to.have.property('url').and.contains('forcedotcom/sfdx-core');
    });
});
