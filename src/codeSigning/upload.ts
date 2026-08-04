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
