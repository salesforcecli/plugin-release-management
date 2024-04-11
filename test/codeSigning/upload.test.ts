/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
