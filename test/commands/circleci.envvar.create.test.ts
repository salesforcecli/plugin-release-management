/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { Config } from '@oclif/core';
import { UX } from '@salesforce/command';
import { expect } from 'chai';
import { stubMethod, fromStub, stubInterface } from '@salesforce/ts-sinon';
import { env } from '@salesforce/kit';
import got from 'got';
import { EnvvarModificationStatus } from '../../src/circleCiEnvvars';
import CircleCIEnvvarCreate, { CircelCIEnvvarCreateStatus } from '../../src/commands/circleci/envvar/create';

const FAKE_ENVVAR_VALUE = 'test value';

function expectSlugStatus(slugs: string[], result: CircelCIEnvvarCreateStatus) {
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

before(async () => {
  process.env['CIRCLE_CI_TOKEN'] = '123456';
});

describe('circleci envvar create', () => {
  const sandbox = sinon.createSandbox();

  const promptStub = stubMethod(sandbox, UX.prototype, 'prompt');
  let gotGetStub: sinon.SinonStub;
  let gotPostStub: sinon.SinonStub;

  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));

  class TestCircleCIEnvvarCreate extends CircleCIEnvvarCreate {
    public async runIt() {
      await this.init();
      this.ux.prompt = promptStub;
      return this.run();
    }
  }

  const runCircleCIEnvVarCreateCmd = async (params: string[]) => {
    const cmd = new TestCircleCIEnvvarCreate(params, oclifConfigStub);
    return cmd.runIt();
  };

  beforeEach(() => {
    gotGetStub = stubMethod(sandbox, got, 'get');
    gotPostStub = stubMethod(sandbox, got, 'post');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should create envvar on slug from process envvar', async () => {
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);
    gotGetStub.resolves({ body: '{ "items": [] }' });
    gotPostStub.resolves();

    const result = await runCircleCIEnvVarCreateCmd([
      '--slug=gh/salesforcecli/plugin-auth',
      '--envvar=MYENVVAR',
      '--json',
    ]);
    expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
  });

  it('should create envvar on slug from prompt', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    gotPostStub.resolves();
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(false);

    promptStub.resolves(FAKE_ENVVAR_VALUE);

    const result = await runCircleCIEnvVarCreateCmd([
      '--slug=gh/salesforcecli/plugin-auth',
      '--envvar=MYENVVAR',
      '--json',
    ]);
    expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
  });

  it('should error if ennvar is set on circle', async () => {
    gotGetStub.resolves({ body: '{ "items": [{ "name": "MYENVVAR" }] }' });
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);

    const result = await runCircleCIEnvVarCreateCmd([
      '--slug=gh/salesforcecli/plugin-auth',
      '--envvar=MYENVVAR',
      '--json',
    ]);
    expect(result['gh/salesforcecli/plugin-auth']).to.contain('Skipping...');
  });

  it('should error if no envvar are provided with piped input', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(true);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'readPipedInput').resolves('gh/salesforcecli/plugin-auth');

    try {
      await runCircleCIEnvVarCreateCmd(['--envvar=MYENVVAR', '--json']);
    } catch (err) {
      expect(err.message).to.equal('missing envvar value for MYENVVAR');
    }
  });

  it('should read slugs from piped input', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(true);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'readPipedInput').resolves('gh/salesforcecli/plugin-auth');
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);

    const result = await runCircleCIEnvVarCreateCmd(['--envvar=MYENVVAR', '--json']);
    expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
  });

  it('should read slugs from piped json input', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(true);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'readPipedInput').resolves(
      '[ "gh/salesforcecli/plugin-auth" ]'
    );

    const result = await runCircleCIEnvVarCreateCmd(['--envvar=MYENVVAR', '--json']);
    expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
  });

  it('should read slugs from piped command json input', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(true);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'readPipedInput').resolves(
      '{ "result": ["gh/salesforcecli/plugin-auth"]}'
    );

    const result = await runCircleCIEnvVarCreateCmd(['--envvar=MYENVVAR', '--json']);
    expectSlugStatus(['gh/salesforcecli/plugin-auth'], result);
  });

  it('should combine slugs from flags and piped input', async () => {
    gotGetStub.resolves({ body: '{ "items": [] }' });
    stubMethod(sandbox, env, 'getString').returns(FAKE_ENVVAR_VALUE);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'isPipedIn').resolves(true);
    stubMethod(sandbox, TestCircleCIEnvvarCreate.prototype, 'readPipedInput').resolves(
      'gh/salesforcecli/plugin-auth\ngh/salesforcecli/plugin-config'
    );

    const result = await runCircleCIEnvVarCreateCmd([
      '--slug=gh/salesforcecli/plugin-user',
      '--slug=gh/salesforcecli/plugin-trust',
      '--envvar=MYENVVAR',
      '--json',
    ]);
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
