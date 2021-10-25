/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { UX } from '@salesforce/command';
import { expect, test } from '@salesforce/command/lib/test';
import { env } from '@salesforce/kit';
import got from 'got';
import { load } from '@oclif/config';
import chalk = require('chalk');
import CircleCIEnvvarUpdate, { CircelCIEnvvarUpdateStatus } from '../../src/commands/circleci/envvar/update';
import { EnvvarModificationStatus } from '../../src/circleCiEnvvars';

const FAKE_ENVVAR_VALUE = 'test value';

/**
 * Get the typed command result object from stdout. Expects a successful json output.
 *
 * @param stdout the stdout of a command
 */
function getResults(stdout: string): CircelCIEnvvarUpdateStatus {
  // Output should not contain envvar values
  expect(stdout).to.not.contain(FAKE_ENVVAR_VALUE);
  const output = JSON.parse(stdout) as { message: string; stack: string; result: CircelCIEnvvarUpdateStatus };
  expect(output.message, `${output.message}: ${output.stack}`).to.be.undefined;
  return output.result;
}

/**
 * Expect slug status from a CircelCIEnvvarUpdateStatus object.
 *
 * @param slugs a list of slugs
 * @param result a command result
 */
function expectSlugStatus(slugs: string[], result: CircelCIEnvvarUpdateStatus) {
  const updatedSlugs = Object.keys(result);
  expect(updatedSlugs.length).to.equal(slugs.length);
  const matchedUpdates = updatedSlugs.filter((repo) => {
    // If the update isn't successful, the result could be an error message.
    expect(typeof result[repo], result[repo] as string).to.not.equal('string');

    const updateStatus = result[repo] as EnvvarModificationStatus[];
    updateStatus.forEach((status) => expect(status.success).to.equal(true));
    return slugs.includes(repo);
  });
  expect(matchedUpdates.length).to.equal(updatedSlugs.length);
}

before(async function () {
  // eslint-disable-next-line no-console
  console.log(chalk.yellow('Loading oclif commands into memory'));
  this.timeout(10000);
  // Prime oclif commands into memory
  await load(`${__dirname}/../../`);
  process.env['CIRCLE_CI_TOKEN'] = '123456';
});

describe('circleci envvar update', () => {
  test
    .stub(env, 'getString', () => FAKE_ENVVAR_VALUE)
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--slug=gh/salesforcecli/plugin-auth', '--envvar=MYENVVAR', '--json'])
    .it('should update envvar on slug from process envvar', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
    });

  test
    .stub(UX.prototype, 'prompt', () => Promise.resolve(FAKE_ENVVAR_VALUE))
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--slug=gh/salesforcecli/plugin-auth', '--envvar=MYENVVAR', '--json'])
    .it('should update envvar on slug from prompt', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
    });

  test
    .stub(UX.prototype, 'prompt', () => Promise.resolve(FAKE_ENVVAR_VALUE))
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--slug=gh/salesforcecli/plugin-auth', '--envvar=MYENVVAR', '--json'])
    .it('should error if ennvar not set on circle', (ctx) => {
      const result = getResults(ctx.stdout);
      expect(result['gh/salesforcecli/plugin-auth']).to.contain('Skipping...');
    });

  test
    .stub(CircleCIEnvvarUpdate.prototype, 'isPipedIn', async () => true)
    .stub(CircleCIEnvvarUpdate.prototype, 'readPipedInput', async () => 'gh/salesforcecli/plugin-auth')
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--envvar=MYENVVAR', '--json'])
    .it('should error if no envvar are provided with piped input', (ctx) => {
      expect(ctx.stdout).to.contain('missing envvar value');
    });

  test
    .stub(env, 'getString', () => FAKE_ENVVAR_VALUE)
    .stub(CircleCIEnvvarUpdate.prototype, 'isPipedIn', async () => true)
    .stub(CircleCIEnvvarUpdate.prototype, 'readPipedInput', async () => 'gh/salesforcecli/plugin-auth')
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--envvar=MYENVVAR', '--json'])
    .it('should read slugs from piped input', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
    });

  test
    .stub(env, 'getString', () => FAKE_ENVVAR_VALUE)
    .stub(CircleCIEnvvarUpdate.prototype, 'isPipedIn', async () => true)
    .stub(CircleCIEnvvarUpdate.prototype, 'readPipedInput', async () => '[ "gh/salesforcecli/plugin-auth" ]')
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--envvar=MYENVVAR', '--json'])
    .it('should read slugs from piped json input', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
    });

  test
    .stub(env, 'getString', () => FAKE_ENVVAR_VALUE)
    .stub(CircleCIEnvvarUpdate.prototype, 'isPipedIn', async () => true)
    .stub(CircleCIEnvvarUpdate.prototype, 'readPipedInput', async () => '{ "result": ["gh/salesforcecli/plugin-auth"]}')
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command(['circleci:envvar:update', '--envvar=MYENVVAR', '--json'])
    .it('should read slugs from piped command json input', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
    });

  test
    .stub(env, 'getString', () => FAKE_ENVVAR_VALUE)
    .stub(CircleCIEnvvarUpdate.prototype, 'isPipedIn', async () => true)
    .stub(
      CircleCIEnvvarUpdate.prototype,
      'readPipedInput',
      async () => 'gh/salesforcecli/plugin-auth\ngh/salesforcecli/plugin-config'
    )
    .stub(got, 'get', () => Promise.resolve({ body: '{ "items": [{ "name": "MYENVVAR" }] }' }))
    .stub(got, 'delete', () => Promise.resolve())
    .stub(got, 'post', () => Promise.resolve())
    .stdout()
    .command([
      'circleci:envvar:update',
      '--slug=gh/salesforcecli/plugin-user',
      '--slug=gh/salesforcecli/plugin-trust',
      '--envvar=MYENVVAR',
      '--json',
    ])
    .it('should combine slugs from flags and piped input', (ctx) => {
      const result = getResults(ctx.stdout);
      expectSlugStatus(
        [
          'gh/salesforcecli/plugin-auth',
          'gh/salesforcecli/plugin-config',
          'gh/salesforcecli/plugin-user',
          'gh/salesforcecli/plugin-trust',
        ],
        result
      );
    });
});
