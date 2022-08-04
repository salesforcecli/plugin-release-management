/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config } from '@oclif/core';
import { expect } from '@salesforce/command/lib/test';
import Inspect from '../../src/commands/cli/versions/inspect';
import { Channel, Info, Location } from '../../src/commands/cli/versions/inspect';

describe('cli:versions:inspect', () => {
  let cmd;
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
