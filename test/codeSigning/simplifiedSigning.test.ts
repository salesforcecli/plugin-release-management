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
import { writeFile, unlink } from 'node:fs/promises';
import { expect } from 'chai';
import { signVerifyUpload, BASE_URL, SECURITY_PATH } from '../../src/codeSigning/SimplifiedSigning.js';

describe('end-to-end signing locally', () => {
  const filepath = 'filepath.tgz';
  before(async () => {
    await writeFile(filepath, 'Mary had a little lamb', { encoding: 'binary' });
  });
  after(async () => {
    await unlink(filepath);
  });

  it('no namespace', async () => {
    const request = {
      upload: false, // we don't really want to send things to AWS
      packageName: 'no-namespace',
      packageVersion: '1.0.0',
      targetFileToSign: filepath,
    };
    const signResult = await signVerifyUpload(request);
    expect(signResult).to.include.keys(['publicKeyContents', 'signatureContents']);
    expect(signResult.packageJsonSfdxProperty).to.deep.equal({
      publicKeyUrl: `${BASE_URL}/${SECURITY_PATH}/${request.packageName}/${request.packageVersion}.crt`,
      signatureUrl: `${BASE_URL}/${SECURITY_PATH}/${request.packageName}/${request.packageVersion}.sig`,
    });
  });

  it('with namespace', async () => {
    const request = {
      upload: false, // we don't really want to send things to AWS
      packageName: '@salesforce/has-namespace',
      packageVersion: '1.0.0',
      targetFileToSign: filepath,
    };
    const signResult = await signVerifyUpload(request);
    expect(signResult).to.include.keys(['publicKeyContents', 'signatureContents']);
    expect(signResult.packageJsonSfdxProperty).to.deep.equal({
      publicKeyUrl: `${BASE_URL}/${SECURITY_PATH}/${request.packageName}/${request.packageVersion}.crt`,
      signatureUrl: `${BASE_URL}/${SECURITY_PATH}/${request.packageName}/${request.packageVersion}.sig`,
    });
  });
});
