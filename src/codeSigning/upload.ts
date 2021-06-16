/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
import { fs } from '@salesforce/core';
import * as AWS from 'aws-sdk';
import { Agents } from 'got';
import { WebIdentityCredentials } from 'aws-sdk';
import { api } from '../codeSigning/packAndSign';
import ClientConfiguration = WebIdentityCredentials.ClientConfiguration;

export async function putObject(bucket: string, key: string, body: string): Promise<AWS.S3.PutObjectOutput> {
  return new Promise((resolve, reject) => {
    const agent = api.getAgentForUri('https://s3.amazonaws.com') as Agents;
    const s3 = new AWS.S3({ httpsOptions: { agent: [agent.http, agent.https] } } as ClientConfiguration);
    s3.putObject({ Bucket: bucket, Key: key, Body: body }, (err, resp) => {
      if (err) reject(err);
      if (resp) resolve(resp);
    });
  });
}

function getUploadKey(signaturePath: string, keyPrefix?: string): string {
  const sigFileName = basename(signaturePath);
  let uploadKey: string;
  if (keyPrefix && keyPrefix.endsWith('/')) {
    uploadKey = `${keyPrefix}${sigFileName}`;
  } else if (keyPrefix) {
    uploadKey = `${keyPrefix}/${sigFileName}`;
  } else {
    uploadKey = sigFileName;
  }
  return uploadKey;
}

export async function upload(
  signaturePath: string,
  bucket: string,
  keyPrefix?: string
): Promise<AWS.S3.PutObjectOutput> {
  const signature = await fs.readFile(signaturePath, { encoding: 'utf-8' });
  const sigFileName = basename(signaturePath);
  const uploadKey = getUploadKey(sigFileName, keyPrefix);
  return putObject(bucket, uploadKey, signature);
}
