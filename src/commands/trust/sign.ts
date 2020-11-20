/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { api as packAndSignApi, SigningOpts, SigningResponse } from '../../codeSigning/packAndSign';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'trust.sign');

export default class Sign extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    signatureurl: flags.string({
      char: 's',
      required: true,
      description: messages.getMessage('signatureUrl'),
    }),
    publickeyurl: flags.string({
      char: 'p',
      required: true,
      description: messages.getMessage('publicKeyUrl'),
    }),
    privatekeypath: flags.string({
      char: 'k',
      required: true,
      description: messages.getMessage('privateKeyPath'),
    }),
    target: flags.string({
      char: 't',
      required: false,
      description: messages.getMessage('target'),
      exclusive: ['tarpath'],
    }),
    tarpath: flags.string({
      description: messages.getMessage('tarPath'),
      exclusive: ['target'],
    }),
  };

  public async run(): Promise<SigningResponse> {
    const opts = this.flags as SigningOpts;
    packAndSignApi.setUx(this.ux);

    if (this.flags.tarpath) {
      return packAndSignApi.doSign(opts);
    } else {
      return packAndSignApi.doPackAndSign(opts);
    }
  }
}
