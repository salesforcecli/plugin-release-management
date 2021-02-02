/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import * as AWS from 'aws-sdk';
import { upload } from '../../codeSigning/upload';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'trust.upload');

export default class Fingerprint extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  protected static flagsConfig: FlagsConfig = {
    signature: flags.string({
      char: 'f',
      required: true,
      description: messages.getMessage('signature'),
    }),
    bucket: flags.string({
      char: 'b',
      required: true,
      description: messages.getMessage('bucket'),
    }),
    keyprefix: flags.string({
      char: 'k',
      required: false,
      description: messages.getMessage('keyPrefix'),
    }),
  };

  public async run(): Promise<AWS.S3.PutObjectOutput> {
    const env = new Env();
    if (!env.getString('AWS_SECRET_ACCESS_KEY') || !env.getString('AWS_ACCESS_KEY_ID')) {
      throw new SfdxError(messages.getMessage('MissingAwsEnVars'));
    }
    try {
      const response = await upload(this.flags.signature, this.flags.bucket, this.flags.keyprefix);
      this.ux.log(response.ETag);
      return response;
    } catch (err) {
      const error = err as SfdxError;
      throw new SfdxError(error.name);
    }
  }
}
