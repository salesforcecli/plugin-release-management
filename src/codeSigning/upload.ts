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

import AWS from 'aws-sdk';
import { Agents } from 'got';
import { WebIdentityCredentials } from 'aws-sdk';
import { api } from './packAndSign.js';
import ClientConfiguration = WebIdentityCredentials.ClientConfiguration;

export async function putObject(bucket: string, key: string, body: string): Promise<AWS.S3.PutObjectOutput> {
  return new Promise((resolve, reject) => {
    const agent = api.getAgentForUri('https://s3.amazonaws.com') as Agents;
    const s3 = new AWS.S3({
      httpOptions: { agent: agent.http },
      httpsOptions: { agent: agent.https },
    } as ClientConfiguration);
    s3.putObject({ Bucket: bucket, Key: key, Body: body }, (err, resp) => {
      if (err) reject(err);
      if (resp) resolve(resp);
    });
  });
}
