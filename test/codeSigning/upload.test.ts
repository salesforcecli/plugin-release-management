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
import { CreateMultipartUploadCommand, UploadPartCommand, S3, PutObjectCommand } from '@aws-sdk/client-s3';
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { putObject } from '../../src/codeSigning/upload.js';

describe('Upload', () => {
  const $$ = new TestContext();
  let clientMock: AwsClientStub<S3>;

  beforeEach(() => {
    clientMock = mockClient(S3);
    clientMock.on(PutObjectCommand).resolves({ ETag: '12345' });
    clientMock.on(CreateMultipartUploadCommand).resolves({ UploadId: '1' });
    clientMock.on(UploadPartCommand).resolves({ ETag: '12345' });
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    clientMock.restore();
  });

  it('should upload an object to S3', async () => {
    const response = await putObject('my-plugin-1.0.0.sig', 'my-bucket', 'media/signatures');
    expect(response).to.deep.equal({ ETag: '12345' });
  });
});
