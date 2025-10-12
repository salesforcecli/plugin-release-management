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
import AWSMock from 'aws-sdk-mock';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { putObject } from '../../src/codeSigning/upload.js';

describe('Upload', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    AWSMock.setSDKInstance(AWS);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    AWSMock.restore('S3');
  });

  it('should upload an object to S3', async () => {
    AWSMock.mock('S3', 'putObject', (params, callback) => {
      callback(undefined, { ETag: '12345' });
    });
    const response = await putObject('my-plugin-1.0.0.sig', 'my-bucket', 'media/signatures');
    expect(response).to.deep.equal({ ETag: '12345' });
  });
});
