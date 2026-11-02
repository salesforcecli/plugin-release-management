/*
 * Copyright 2026, Salesforce, Inc.
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
import os from 'node:os';
import path from 'node:path';
import sinon from 'sinon';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { fromStub, stubInterface } from '@salesforce/ts-sinon';
import Release from '../../src/commands/npm/package/release.js';
import { PackageRepo } from '../../src/repository.js';

describe('npm:package:release', () => {
  const sandbox = sinon.createSandbox();
  const oclifConfigStub = fromStub(stubInterface<Config>(sandbox));
  oclifConfigStub.runHook = async () => ({ successes: [], failures: [] });

  class TestRelease extends Release {
    public async runIt() {
      await this.init();
      return this.run();
    }
  }

  let root: string;
  let original: string;
  let publishedDependencies: Array<Record<string, string>>;

  const stubRepo = (publish: () => Promise<void>): void => {
    const packageJson = JSON.parse(original) as PackageRepo['package']['packageJson'];
    sandbox.stub(PackageRepo, 'create').resolves({
      name: packageJson.name,
      nextVersion: '1.0.0',
      package: { location: root, packageJson },
      printStage: () => {},
      sign: async () => {
        publishedDependencies.push(readDependencies());
        return {};
      },
      publish: async () => {
        publishedDependencies.push(readDependencies());
        return publish();
      },
      getSuccessMessage: () => 'done',
    } as unknown as PackageRepo);
  };

  const readDependencies = (): Record<string, string> =>
    (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> })
      .dependencies;

  const run = (flags: string[]) =>
    new TestRelease(
      ['--no-install', '--dryrun', '--trusted-publishing', '--githubtag', 'v1.0.0', '--no-verify', ...flags],
      oclifConfigStub
    ).runIt();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-pin-'));
    original = `${JSON.stringify(
      { name: '@salesforce/cli', version: '1.0.0', oclif: {}, dependencies: { a: '^1' }, devDependencies: {} },
      null,
      4
    )}\n`;
    fs.writeFileSync(path.join(root, 'package.json'), original);
    for (const [dir, pkg] of [
      ['node_modules/a', { name: 'a', version: '1.2.0', dependencies: { b: '^2' } }],
      ['node_modules/b', { name: 'b', version: '2.3.0' }],
    ] as const) {
      fs.mkdirSync(path.join(root, dir), { recursive: true });
      fs.writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify(pkg));
    }
    publishedDependencies = [];
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('publishes pinned dependencies and restores package.json', async () => {
    stubRepo(async () => {});
    await run([]);
    expect(publishedDependencies).to.deep.equal([{ a: '1.2.0', b: '2.3.0' }]);
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).to.equal(original);
  });

  it('restores package.json when publishing fails', async () => {
    stubRepo(async () => {
      throw new Error('E403');
    });
    try {
      await run([]);
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).to.equal('E403');
    }
    expect(publishedDependencies).to.deep.equal([{ a: '1.2.0', b: '2.3.0' }]);
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).to.equal(original);
  });

  it('publishes the repo ranges with --no-pin-dependencies', async () => {
    stubRepo(async () => {});
    await run(['--no-pin-dependencies']);
    expect(publishedDependencies).to.deep.equal([{ a: '^1' }]);
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).to.equal(original);
  });
});
