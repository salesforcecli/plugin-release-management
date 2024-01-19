/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { testJITInstall } from '../../../../jit.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.install.jit.test');

export default class Test extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'jit-plugin': Flags.string({
      summary: messages.getMessage('flags.jit-plugin.summary'),
      char: 'j',
      multiple: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Test);
    await testJITInstall({
      jsonEnabled: this.jsonEnabled(),
      jitPlugin: flags['jit-plugin'],
      executable: process.platform === 'win32' ? join('bin', 'run.cmd') : join('bin', 'run'),
    });
  }
}
