/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
