/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */

import child_process from 'node:child_process';
import { EOL } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import got from 'got';
import { api as packAndSignApi } from '../../src/codeSigning/packAndSign.js';
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert.js';

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

const REJECT_ERROR = new Error('Should have been rejected');

describe('packAndSign', () => {
  const $$ = new TestContext();

  describe('doPackAndSign', () => {
    before(() => {
      let signature: string;

      stubMethod($$.SANDBOX, got, 'get').callsFake(async (path: string) => _getCertResponse(path));

      $$.SANDBOX.stub(console, 'log');
      $$.SANDBOX.stub(console, 'info');

      stubMethod($$.SANDBOX, fs, 'copyFile').callsFake((src: string, dest: string, cb: any) => {
        cb(null, {});
      });

      stubMethod($$.SANDBOX, fs, 'unlink').returns(Promise.resolve());

      stubMethod($$.SANDBOX, fs, 'writeFile').callsFake((path: string, content: string) => {
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
    });
  });

  describe('packAndSign Tests', () => {
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

    describe('validateNpmIgnore', () => {
      it('no content', () => {
        // @ts-expect-error testing invalid input
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

    // minimal test since the function getAgentForUrl delegates to proxy-agent module
    describe('getAgentForUri', () => {
      it('should always return an agent', () => {
        const agents = packAndSignApi.getAgentForUri('https://somewhere.com');
        expect(agents).to.be.ok;
      });
    });
  });
});
