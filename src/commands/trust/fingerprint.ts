/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { api } from '../../codeSigning/packAndSign';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'trust.fingerprint');

export default class Fingerprint extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    publickeyurl: flags.string({
      char: 'p',
      required: true,
      description: messages.getMessage('publicKeyUrl'),
    }),
  };

  public async run(): Promise<{ fingerprint: string }> {
    const fingerprint = await api.retrieveFingerprint(this.flags.publickeyurl);
    this.ux.log(fingerprint);
    return { fingerprint };
  }
}
