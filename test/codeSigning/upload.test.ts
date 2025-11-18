/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
