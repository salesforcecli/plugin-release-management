/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { generateKeyPair, createSign, createVerify } from 'crypto';
import { createReadStream } from 'fs';
import { S3 } from 'aws-sdk';
import { putObject } from '../codeSigning/upload';

const CRYPTO_LEVEL = 'RSA-SHA256';
const BUCKET = 'dfc-data-production';
export const BASE_URL = 'https://developer.salesforce.com';
export const SECURITY_PATH = 'media/salesforce-cli/security';

interface SigningRequest {
  targetFileToSign: string; // path to the file on local FS
  packageName: string; // npm name, including namespace
  packageVersion: string; // npm version
  upload: boolean; // do you want the key/sig uploaded to AWS
}

export interface SigningResponse {
  publicKeyContents: string;
  signatureContents: string;
  // matches this pattern for npm meta
  // "sfdx": {
  //     "publicKeyUrl": "https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt",
  //     "signatureUrl": "https://developer.salesforce.com/media/salesforce-cli/signatures/salesforce-plugin-user-1.3.0.sig"
  //   },
  packageJsonSfdxProperty: {
    publicKeyUrl: string;
    signatureUrl: string;
  };
  fileTarPath: string;
  packageName: string; // npm name, including namespace
  packageVersion: string; // npm version
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export const sign = async (signingRequest: SigningRequest): Promise<SigningResponse> => {
  const { publicKey, privateKey } = await getOneTimeUseKeys();
  const { packageName, packageVersion } = signingRequest;
  const fullPathNoExtension = `${BASE_URL}/${SECURITY_PATH}/${packageName}/${packageVersion}`;
  const signatureContents = await getSignature(privateKey, signingRequest.targetFileToSign);

  // verify that signature/key/data worked properly
  await verify(signingRequest.targetFileToSign, publicKey, signatureContents);
  const output: SigningResponse = {
    publicKeyContents: publicKey,
    signatureContents,
    packageJsonSfdxProperty: {
      publicKeyUrl: `${fullPathNoExtension}.crt`,
      signatureUrl: `${fullPathNoExtension}.sig`,
    },
    fileTarPath: signingRequest.targetFileToSign,
    packageName,
    packageVersion,
  };

  if (signingRequest.upload) {
    await upload(output);
  }
  return output;
};

// save the security items to AWS based on the generates filenames
const upload = async (input: SigningResponse): Promise<S3.PutObjectOutput[]> => {
  return Promise.all([
    // signature file
    putObject(BUCKET, input.packageJsonSfdxProperty.signatureUrl.replace(`${BASE_URL}/`, ''), input.signatureContents),
    // publicKey
    putObject(BUCKET, input.packageJsonSfdxProperty.publicKeyUrl.replace(`${BASE_URL}/`, ''), input.publicKeyContents),
  ]);
};

const getOneTimeUseKeys = (): Promise<KeyPair> => {
  return new Promise<KeyPair>((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      },
      (err, publicKey, privateKey) => {
        if (err) reject(err);
        resolve({
          publicKey,
          privateKey,
        });
      }
    );
  });
};

const getSignature = async (privateKey: string, dataToSignFilePath: string): Promise<string> => {
  const signApi = createSign(CRYPTO_LEVEL);

  return new Promise<string>((resolve, reject) => {
    const dataToSignStream = createReadStream(dataToSignFilePath, { encoding: 'binary' });
    dataToSignStream.pipe(signApi);
    dataToSignStream.on('end', () => {
      return resolve(signApi.sign(privateKey, 'base64'));
    });

    dataToSignStream.on('error', (err) => {
      return reject(err);
    });
  });
};

const verify = async (dataToSignFilePath: string, publicKey: string, signature: string): Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    const verifier = createVerify(CRYPTO_LEVEL);
    const dataToVerifyStream = createReadStream(dataToSignFilePath, { encoding: 'binary' });
    dataToVerifyStream.pipe(verifier);
    dataToVerifyStream.on('end', () => {
      if (verifier.verify(publicKey, signature)) {
        return resolve(true);
      }
      return reject('The signature did not verify');
    });

    dataToVerifyStream.on('error', (err) => {
      return reject(err);
    });
  });
};
