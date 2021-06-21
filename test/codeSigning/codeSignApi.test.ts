/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Readable } from 'stream';
import { expect } from 'chai';
import { CodeSignInfo, CodeVerifierInfo, default as sign, verify } from '../../src/codeSigning/codeSignApi';
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert';

describe('Sign Tests', () => {
  it('steel thread', async () => {
    const info = new CodeSignInfo();

    info.dataToSignStream = new Readable({
      read() {
        this.push(TEST_DATA);
        this.push(null);
      },
    });

    info.privateKeyStream = new Readable({
      read() {
        this.push(PRIVATE_KEY);
        this.push(null);
      },
    });
    const signature = await sign(info).then();

    const verifyInfo = new CodeVerifierInfo();
    verifyInfo.publicKeyStream = new Readable({
      read() {
        this.push(CERTIFICATE);
        this.push(null);
      },
    });

    verifyInfo.signatureStream = new Readable({
      read() {
        this.push(signature);
        this.push(null);
      },
    });

    verifyInfo.dataToVerify = new Readable({
      read() {
        this.push(TEST_DATA);
        this.push(null);
      },
    });

    const valid = await verify(verifyInfo);
    expect(valid).to.be.equal(true);
  });

  it('invalid private key', async () => {
    const info = new CodeSignInfo();

    info.dataToSignStream = new Readable({
      read() {
        this.push(TEST_DATA);
        this.push(null);
      },
    });

    info.privateKeyStream = new Readable({
      read() {
        this.push('key');
        this.push(null);
      },
    });
    return sign(info)
      .then(() => {
        throw new Error('This should reject');
      })
      .catch((err: any) => {
        expect(err).to.have.property('name', 'InvalidKeyFormat');
      });
  });

  it('invalid signature', async () => {
    const verifyInfo = new CodeVerifierInfo();
    verifyInfo.publicKeyStream = new Readable({
      read() {
        this.push(CERTIFICATE);
        this.push(null);
      },
    });

    verifyInfo.signatureStream = new Readable({
      read() {
        this.push('');
        this.push(null);
      },
    });

    verifyInfo.dataToVerify = new Readable({
      read() {
        this.push(TEST_DATA);
        this.push(null);
      },
    });

    return verify(verifyInfo)
      .then(() => {
        throw new Error('This should reject');
      })
      .catch((err) => {
        expect(err).to.have.property('name', 'InvalidSignature');
      });
  });
});
