/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as events from 'events';
import { Readable } from 'stream';
import { expect } from 'chai';
import {
  CodeSignInfo,
  CodeVerifierInfo,
  default as sign,
  validateRequestCert,
  validSalesforceHostname,
  verify,
} from '../../src/codeSigning/codeSignApi';
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert';

describe('Sign Tests', () => {
  describe('validSalesforceHostname', () => {
    const currentCertSigVar = process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING;
    before(() => {
      delete process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING;
    });
    after(() => {
      if (currentCertSigVar) {
        process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING = currentCertSigVar;
      }
    });
    it('falsy url', () => {
      expect(validSalesforceHostname(null)).to.be.equal(false);
    });

    it('salesforce http url', () => {
      expect(validSalesforceHostname('http://developer.salesforce.com')).to.be.equal(false);
    });

    it('salesforce https url', () => {
      expect(validSalesforceHostname('https://developer.salesforce.com')).to.be.equal(true);
    });
    it('jibber', () => {
      expect(validSalesforceHostname('jj')).to.be.equal(false);
    });

    it('evildoers', () => {
      expect(validSalesforceHostname('salesforce.com-evildoers-r-us.com')).to.be.equal(false);
    });

    it('salesforce.com no env', () => {
      expect(validSalesforceHostname('salesforce.com-evildoers-r-us.com')).to.be.equal(false);
    });

    it('salesforce.com port', () => {
      expect(validSalesforceHostname('https://developer.salesforce.com:9797')).to.be.equal(true);
    });

    it('salesforce.com env var true', () => {
      process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING = 'true';
      expect(validSalesforceHostname('https://tnoonan-wsm2.internal.salesforce.com')).to.be.equal(true);
      delete process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING;
    });

    it('salesforce.com env var falsy', () => {
      process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING = 'jj';
      expect(validSalesforceHostname('https://tnoonan-wsm2.internal.salesforce.com')).to.be.equal(false);
      delete process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING;
    });
  });

  describe('validateRequestCert', () => {
    it('invalid finger print', () => {
      delete process.env.SFDX_DISABLE_CERT_PINNING;
      try {
        // eslint-disable-next-line prettier/prettier
        class Request extends events.EventEmitter { }

        const request = new Request();

        class Socket extends events.EventEmitter {
          public getPeerCertificate() {
            return { fingerprint: '123456' };
          }
        }

        const socket = new Socket();

        validateRequestCert(request);
        request.emit('socket', socket);
        socket.emit('secureConnect');
        throw new Error("Shouldn't Get Here!");
      } catch (err) {
        expect(err).to.have.property('name', 'CertificateFingerprintNotMatch');
      }
    });
  });

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
