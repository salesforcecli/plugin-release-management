/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */

import child_process = require('child_process');
import { EOL } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import * as fs from 'fs';
import { URL } from 'url';
import { core, UX } from '@salesforce/command';
import { fs as fscore } from '@salesforce/core';
import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import got from 'got';
import { env } from '@salesforce/kit';
import { SigningResponse } from '../../src/codeSigning/packAndSign';
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert';

const $$ = testSetup();

const _getCertResponse = (path: string, e?: Error, statusCode?: number) => {
  const response = {};
  (response as any).body = CERTIFICATE;

  if (statusCode) {
    (response as any).statusCode = statusCode;
  } else {
    (response as any).statusCode = 200;
  }

  if (e) {
    throw e;
  }
  return response;
};

let packAndSignApi: any;

const REJECT_ERROR = new Error('Should have been rejected');

describe('doPackAndSign', () => {
  before(() => {
    let signature: string;

    stubMethod($$.SANDBOX, got, 'get').callsFake(async (path: string) => {
      return _getCertResponse(path);
    });

    $$.SANDBOX.stub(console, 'log');
    $$.SANDBOX.stub(console, 'info');

    stubMethod($$.SANDBOX, fs, 'copyFile').callsFake((src: string, dest: string, cb: any) => {
      cb(null, {});
    });

    stubMethod($$.SANDBOX, fscore, 'unlink').returns(Promise.resolve());

    stubMethod($$.SANDBOX, fscore, 'writeFile').callsFake((path: string, content: string) => {
      if (path.includes('.sig')) {
        signature = content;
      }
    });

    stubMethod($$.SANDBOX, fs, 'createReadStream').callsFake((filePath: string) => {
      if (filePath.includes('privateKey')) {
        return new Readable({
          read() {
            this.push(PRIVATE_KEY);
            this.push(null);
          },
        });
      } else if (filePath.includes('tgz')) {
        return new Readable({
          read() {
            this.push(TEST_DATA);
            this.push(null);
          },
        });
      } else {
        return new Readable({
          read() {
            this.push(signature);
            this.push(null);
          },
        });
      }
    });

    stubMethod($$.SANDBOX, child_process, 'exec').callsFake((command, opts, cb) => {
      cb(null, `foo.tgz${EOL}`);
    });

    packAndSignApi = require('../../src/codeSigning/packAndSign').api;
  });

  it('Steel Thread', async () => {
    const flags = {
      signatureurl: 'https://developer.salesforce.com/signatureUrlValue',
      publickeyurl: 'https://developer.salesforce.com/publicKeyUrlValue',
      privatekeypath: 'privateKeyPathUrl',
    };

    const ux: UX = new UX(await core.Logger.child('packAndSignTests'));
    packAndSignApi.setUx(ux);
    return packAndSignApi.doPackAndSign(flags).then((result: SigningResponse) => {
      expect(result.verified).to.be.equal(true);
    });
  });
});

describe('packAndSign Tests', () => {
  beforeEach(() => {
    if (!packAndSignApi) {
      packAndSignApi = require('../../src/codeSigning/packAndSign').api;
    }
  });

  describe('validate url', () => {
    it('with host', () => {
      const TEST = 'https://developer.salesforce.com/foo/bar';
      expect(() => packAndSignApi.validateUrl(TEST)).to.not.throw(Error);
    });

    it('with host', () => {
      const TEST = 'https://www.example.com/foo/bar';
      expect(() => packAndSignApi.validateUrl(TEST)).to.throw(Error);
    });

    it('no host', () => {
      const TEST = 'foo/bar';
      expect(() => packAndSignApi.validateUrl(TEST)).to.throw(Error);
    });
  });

  describe('pack', () => {
    it('Process Failed', () => {
      stubMethod($$.SANDBOX, child_process, 'exec').callsFake((command: string, opts: any, cb: any) => {
        cb({ code: -15 });
      });
      return packAndSignApi
        .pack()
        .then(() => {
          throw REJECT_ERROR;
        })
        .catch((err: Error) => {
          expect(err.message).to.include("code '-15'");
          expect(err).to.have.property('cause');
        });
    });

    it('Process Success', () => {
      stubMethod($$.SANDBOX, child_process, 'exec').callsFake((command: string, opts: any, cb: any) => {
        cb(null, `foo.tgz${EOL}`);
      });
      return packAndSignApi.pack().then((path: string) => {
        expect(path).to.be.equal(join(process.cwd(), 'foo.tgz'));
      });
    });

    it('Process path unexpected format', () => {
      stubMethod($$.SANDBOX, child_process, 'exec').callsFake((command: string, opts: any, cb: any) => {
        cb(null, `foo${EOL}`);
      });
      return packAndSignApi
        .pack()
        .then(() => {
          throw REJECT_ERROR;
        })
        .catch((err: Error) => {
          expect(err.message).to.include('expected tgz');
          expect(err).to.have.property('name', 'UnexpectedNpmFormat');
        });
    });

    it('Process path unexpected format', () => {
      stubMethod($$.SANDBOX, child_process, 'exec').callsFake((command: string, opts: any, cb: any) => {
        cb(null, 'foo');
      });
      return packAndSignApi
        .pack()
        .then(() => {
          throw REJECT_ERROR;
        })
        .catch((err: Error) => {
          expect(err.message).to.include('npm utility');
          expect(err).to.have.property('name', 'UnexpectedNpmFormat');
        });
    });
  });

  describe('writeSignatureFile', () => {
    it('no tgz', () => {
      return packAndSignApi
        .writeSignatureFile('foo')
        .then(() => {
          throw new Error("This shouldn't happen");
        })
        .catch((e) => {
          expect(e).to.have.property('name', 'UnexpectedTgzName');
        });
    });
  });

  describe('verify', () => {
    it('verify flow - false', () => {
      let url: string;
      stubMethod($$.SANDBOX, got, 'get').callsFake(async (_url: string) => {
        url = _url;
        return _getCertResponse(_url);
      });

      const tarGz = new Readable({
        read() {
          this.push('foo');
          this.push(null);
        },
      });

      const signature = new Readable({
        read() {
          this.push('bar');
          this.push(null);
        },
      });

      if (!packAndSignApi) {
        packAndSignApi = require('../../src/codeSigning/packAndSign').api;
      }

      return packAndSignApi.verify(tarGz, signature, 'https://baz').then((authentic: boolean) => {
        expect(authentic).to.be.equal(false);
        expect(url).to.be.equal('https://baz');
      });
    });

    it('verify flow - self signed', () => {
      stubMethod($$.SANDBOX, got, 'get').callsFake(async (_url: string) => {
        const e: any = new Error();
        e.code = 'DEPTH_ZERO_SELF_SIGNED_CERT';
        return _getCertResponse(_url, e);
      });

      const tarGz = new Readable({
        read() {
          this.push('foo');
          this.push(null);
        },
      });

      const signature = new Readable({
        read() {
          this.push('bar');
          this.push(null);
        },
      });

      if (!packAndSignApi) {
        packAndSignApi = require('../../src/codeSigning/packAndSign').api;
      }

      return packAndSignApi
        .verify(tarGz, signature, 'https://baz.com')
        .then(() => {
          throw new Error('This should never happen');
        })
        .catch((e) => {
          expect(e).to.have.property('name', 'SelfSignedCert');
        });
    });

    it('verify flow - http 500', () => {
      stubMethod($$.SANDBOX, got, 'get').callsFake((_url: string) => {
        return _getCertResponse(_url, undefined, 500);
      });

      const tarGz = new Readable({
        read() {
          this.push('foo');
          this.push(null);
        },
      });

      const signature = new Readable({
        read() {
          this.push('bar');
          this.push(null);
        },
      });

      if (!packAndSignApi) {
        packAndSignApi = require('../../src/codeSigning/packAndSign').api;
      }

      return packAndSignApi
        .verify(tarGz, signature, 'https://baz')
        .then(() => {
          throw new Error('This should never happen');
        })
        .catch((e) => {
          expect(e).to.have.property('name', 'RetrievePublicKeyFailed');
        });
    });
  });

  describe('validateNpmIgnore', () => {
    it('no content', () => {
      expect(() => packAndSignApi.validateNpmIgnorePatterns(undefined))
        .to.throw(Error)
        .and.have.property('name', 'MissingNpmIgnoreFile');
    });

    it('no tgz', () => {
      expect(() => packAndSignApi.validateNpmIgnorePatterns('')).to.throw('tgz');
    });
    it('no sig', () => {
      expect(() => packAndSignApi.validateNpmIgnorePatterns('*.tgz')).to.throw('sig');
    });
    it('no package.json.bak', () => {
      expect(() => packAndSignApi.validateNpmIgnorePatterns('*.tgz*.sig')).to.throw('package.json.bak');
    });
    it('has expected patterns', () => {
      expect(packAndSignApi.validateNpmIgnorePatterns('*.tgz*.sigpackage.json.bak')).to.be.equal(undefined);
    });
  });

  describe('getAgentForUri', () => {
    it('should return no agent when no proxy env vars are set', () => {
      const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
      expect(agents).to.be.false;
    });
    it('should return no agent when no_proxy env var contains target host name', () => {
      stubMethod($$.SANDBOX, env, 'getString').returns('somewhere.com');
      const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
      expect(agents).to.be.false;
    });
    it('should return https agent https_proxy env var is set', () => {
      const envEntries = [['https_proxy', 'https://some.https.proxy.com:8080']];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns(envEntries[0][1]);
      const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
      const proxy = agents.https.proxy;
      expect(proxy.toString()).to.equal(new URL('https://some.https.proxy.com:8080').toString());
      expect(agents.https.protocol).to.equal('https:');
    });
    it('should return https agent http_proxy env var is set', () => {
      const envEntries = [['http_proxy', 'http://some.https.proxy.com:8080']];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns(envEntries[0][1]);
      const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
      const proxy = agents.https.proxy;
      expect(proxy.toString()).to.equal(new URL('http://some.https.proxy.com:8080').toString());
      expect(agents.https.protocol).to.equal('https:');
    });
    it('should return https agent with both https_proxy and http_proxy env vars set', () => {
      const envEntries = [
        ['https_proxy', 'https://some.https.proxy.com:8080'],
        ['http_proxy', 'http://some.other.http.proxy.com:8080'],
      ];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns('');
      const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
      const proxy = agents.https.proxy;
      expect(proxy.toString()).to.equal(new URL('https://some.https.proxy.com:8080').toString());
      expect(agents.https.protocol).to.equal('https:');
    });
    it('should return http agent https_proxy env var is set with target protocol http', () => {
      const envEntries = [['https_proxy', 'https://some.https.proxy.com:8080']];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns('');
      const agents = packAndSignApi.getAgentForUri('http://somewhere.com');
      const proxy = agents.https.proxy;
      expect(proxy.toString()).to.equal(new URL('https://some.https.proxy.com:8080').toString());
      expect(agents.https.protocol).to.equal('http:');
    });
    it('should return http agent http_proxy env var is set with target protocol http', () => {
      const envEntries = [['http_proxy', 'http://some.http.proxy.com:8080']];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns(envEntries[0][1]);
      const agents = packAndSignApi.getAgentForUri('http://somewhere.com');
      const proxy = agents.https.proxy;
      expect(proxy.toString()).to.equal(new URL('http://some.http.proxy.com:8080').toString());
      expect(agents.https.protocol).to.equal('http:');
    });
    it('should throw if https_proxy and HTTPS_PROXY are set with different urls', () => {
      const envEntries = [
        ['HTTPS_PROXY', 'https://some.https.proxy.com:8080'],
        ['https_proxy', 'https://some.other.https.proxy.com:8080'],
      ];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns(envEntries[0][1]);
      expect(() => packAndSignApi.getAgentForUri('http://somewhere.com')).to.throw(Error);
    });
    it('should throw if http_proxy and HTTP_PROXY are set with different urls', () => {
      const envEntries = [
        ['HTTP_PROXY', 'http://some.https.proxy.com:8080'],
        ['http_proxy', 'http://some.other.https.proxy.com:8080'],
      ];
      stubMethod($$.SANDBOX, env, 'entries').returns(envEntries);
      stubMethod($$.SANDBOX, env, 'getString').returns(envEntries[0][1]);
      expect(() => packAndSignApi.getAgentForUri('http://somewhere.com')).to.throw(Error);
    });
  });
});
