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
