/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as shelljs from 'shelljs';
import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import * as sinon from 'sinon';
import { stubMethod } from '@salesforce/ts-sinon';
import { inspectCommits } from '../src/inspectCommits';
import { Package } from '../src/package';

const $$ = testSetup();

describe('inspectCommits', () => {
  const packageJson = { name: 'foobar', version: '2.0.0' };

  function buildCommitLog(...commitTypes: string[]): string {
    const commitHash = '2b5efa1bed4934a9f5e3d1b8ed4c411ff4121261';
    let final = '';
    for (const type of commitTypes) {
      final += `${type}: made some changes${os.EOL}${os.EOL}-hash-${os.EOL}${commitHash}${os.EOL}SPLIT${os.EOL}`;
    }
    return final;
  }

  function stubs(commitLog: string, nextVersionIsHardcoded = false) {
    stubMethod($$.SANDBOX, Package.prototype, 'readPackageJson').returns(Promise.resolve(packageJson));
    stubMethod($$.SANDBOX, Package.prototype, 'nextVersionIsHardcoded').returns(nextVersionIsHardcoded);
    stubMethod($$.SANDBOX, shelljs, 'exec')
      .withArgs(sinon.match('npm view'))
      .returns({ stdout: JSON.stringify(packageJson) })
      .withArgs(sinon.match('npm config'))
      .returns({ stdout: 'https://registry.npmjs.org/' })
      .withArgs(sinon.match('git tag'), { silent: true })
      .returns({ stdout: 'v1.0.0' })
      .withArgs(sinon.match('git log'), { silent: true })
      .returns({ stdout: commitLog });
  }

  it('should recommend release when "feat" commits are present', async () => {
    const commitLog = buildCommitLog('feat', 'chore');
    stubs(commitLog);
    const pkg = await Package.create();
    const inspection = await inspectCommits(pkg);
    expect(inspection.shouldRelease).to.be.true;
  });

  it('should recommend release when "fix" commits are present', async () => {
    const commitLog = buildCommitLog('fix', 'chore');
    stubs(commitLog);
    const pkg = await Package.create();
    const inspection = await inspectCommits(pkg);
    expect(inspection.shouldRelease).to.be.true;
  });

  it('should recommend release when the next version is hardcoded', async () => {
    const commitLog = buildCommitLog('chore', 'docs', 'ci');
    stubs(commitLog, true);
    const pkg = await Package.create();
    const inspection = await inspectCommits(pkg);
    expect(inspection.shouldRelease).to.be.true;
  });

  it('should not recommend release when no "fix" or "feat" commits are present', async () => {
    const commitLog = buildCommitLog('chore', 'docs', 'ci');
    stubs(commitLog);
    const pkg = await Package.create();
    const inspection = await inspectCommits(pkg);
    expect(inspection.shouldRelease).to.be.false;
  });

  it('should indicate a major version bump when a breaking commit is found', async () => {
    const commitLog = buildCommitLog('chore', 'feat!');
    stubs(commitLog);
    const pkg = await Package.create();
    const inspection = await inspectCommits(pkg);
    expect(inspection.isMajorBump).to.be.true;
  });
});
