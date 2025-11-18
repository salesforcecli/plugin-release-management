/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { PutObjectCommand, PutObjectCommandOutput, S3 } from '@aws-sdk/client-s3';
import { NodeHttpHandler, NodeHttpHandlerOptions } from '@smithy/node-http-handler';
import { Agents } from 'got';
import { api } from './packAndSign.js';

export async function putObject(bucket: string, key: string, body: string): Promise<PutObjectCommandOutput> {
  const agent = api.getAgentForUri('https://s3.amazonaws.com') as Agents;
  const s3 = new S3({
    region: 'us-east-1',
    requestHandler: new NodeHttpHandler({
      httpAgent: agent.http,
      httpsAgent: agent.https,
    } as NodeHttpHandlerOptions),
  });
  return s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
}
