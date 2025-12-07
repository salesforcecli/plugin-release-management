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
import { Config } from '@oclif/core';
import { expect, config as chaiConfig } from 'chai';
import Inspect from '../../src/commands/cli/versions/inspect.js';
import { Channel, Info, Location } from '../../src/commands/cli/versions/inspect.js';

chaiConfig.truncateThreshold = 0;

describe('cli:versions:inspect', () => {
  let cmd: Inspect | undefined;
  beforeEach(() => {
    cmd = new Inspect(['-c', 'stable', '-l', 'archive'], {} as Config);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    cmd.ux = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      log: () => {},
    };
  });

  it('should throw an error when versions are different', () => {
    const results: Info[] = [
      {
        location: Location.ARCHIVE,
        version: '1.0.0',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.0.0' }],
      },
      {
        location: Location.ARCHIVE,
        version: '1.1.1',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.1.1' }],
      },
    ];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore private method
    expect(() => cmd.logResults(results, Location.ARCHIVE, [Channel.STABLE])).to.throw('Version Mismatch');
  });

  it('should throw an error when versions are different and locations are different', () => {
    const results: Info[] = [
      {
        location: Location.NPM,
        version: '1.0.0',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.0.0' }],
      },
      {
        location: Location.ARCHIVE,
        version: '1.1.1',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.1.1' }],
      },
    ];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore private method
    expect(() => cmd.logResults(results, Location.ARCHIVE, [Channel.STABLE])).to.throw('Version Mismatch');
  });

  it('should not throw an error when versions match', () => {
    const results: Info[] = [
      {
        location: Location.ARCHIVE,
        version: '1.0.0',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.0.0' }],
      },
      {
        location: Location.ARCHIVE,
        version: '1.0.0',
        origin: '',
        channel: Channel.STABLE,
        dependencies: [{ name: 'dep1', version: '1.0.0' }],
      },
    ];
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore private method
      cmd.logResults(results, Location.ARCHIVE, [Channel.STABLE]);
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });
});
