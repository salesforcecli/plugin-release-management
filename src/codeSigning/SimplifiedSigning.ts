/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Signed npm packages have two fields that point plugin-trust to the URLs for the public key and signature file
 * see src/package.ts/#PackageJsonSfdxProperty
 *
 * This code generates a keypair using node's crypto library,
 * signs the tarball,
 * verifies the signature
 * and uploads the .sig and .crt (public key) to their AWS bucket
 *
 * The private key is never persisted to disk and ephemeral (exists only during this signing process)
 * There are no security issues returning the sig/pubKey contents because those will be public
 *
 * This verification uses the sig/crt in memory--it verifies the match before uploading.  Other code verifies it from S3.
 *
 * For security reasons, the url paths and bucket are hardcoded.
 */
import { generateKeyPair, createSign, createVerify } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { S3 } from 'aws-sdk';
import { putObject } from '../codeSigning/upload.js';
import { PackageJsonSfdxProperty } from '../package.js';
const CRYPTO_LEVEL = 'RSA-SHA256';
const BUCKET = 'dfc-data-production';
export const BASE_URL = 'https://developer.salesforce.com';
export const SECURITY_PATH = 'media/salesforce-cli/security';

type SigningRequest = {
  /** path to the file on local FS */
  targetFileToSign: string;
  /** npm name, including namespace */
  packageName: string;
  /** npm version */
  packageVersion: string;
  /** if true, uploads the signature and key file to AWS */
  upload: boolean;
};

export type SigningResponse = {
  publicKeyContents: string;
  signatureContents: string;
  /**
   * matches this pattern for npm meta
   * "sfdx": {
   * "publicKeyUrl": "https://developer.salesforce.com/media/salesforce-cli/sfdx-cli-03032020.crt",
   * "signatureUrl": "https://developer.salesforce.com/media/salesforce-cli/signatures/salesforce-plugin-user-1.3.0.sig"
   * },
   */
  packageJsonSfdxProperty: PackageJsonSfdxProperty;
  fileTarPath: string;
  /** npm name, including namespace */
  packageName: string;
  /** npm version, like 1.0.0 */
  packageVersion: string;
};

type KeyPair = {
  publicKey: string;
  privateKey: string;
};

export const getSfdxProperty = (packageName: string, packageVersion: string): PackageJsonSfdxProperty => {
  const fullPathNoExtension = `${BASE_URL}/${SECURITY_PATH}/${packageName}/${packageVersion}`;
  return {
    publicKeyUrl: `${fullPathNoExtension}.crt`,
    signatureUrl: `${fullPathNoExtension}.sig`,
  };
};

export const signVerifyUpload = async (signingRequest: SigningRequest): Promise<SigningResponse> => {
  const { publicKey, privateKey } = await getOneTimeUseKeys();
  const { packageName, packageVersion } = signingRequest;
  const signatureContents = await getSignature(privateKey, signingRequest.targetFileToSign);

  // verify that signature/key/data worked properly
  await verify(signingRequest.targetFileToSign, publicKey, signatureContents);
  const output: SigningResponse = {
    publicKeyContents: publicKey,
    signatureContents,
    packageJsonSfdxProperty: getSfdxProperty(packageName, packageVersion),
    fileTarPath: signingRequest.targetFileToSign,
    packageName,
    packageVersion,
  };

  if (signingRequest.upload) {
    await upload(output);
  }
  return output;
};

/**
 * Save the security items (publicKey and .sig file) to AWS based on the generates filenames
 */
const upload = async (input: SigningResponse): Promise<S3.PutObjectOutput[]> =>
  Promise.all([
    // signature file
    putObject(BUCKET, input.packageJsonSfdxProperty.signatureUrl.replace(`${BASE_URL}/`, ''), input.signatureContents),
    // publicKey
    putObject(BUCKET, input.packageJsonSfdxProperty.publicKeyUrl.replace(`${BASE_URL}/`, ''), input.publicKeyContents),
  ]);

const getOneTimeUseKeys = (): Promise<KeyPair> =>
  new Promise<KeyPair>((resolve, reject) => {
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

const getSignature = async (privateKey: string, dataToSignFilePath: string): Promise<string> => {
  const signApi = createSign(CRYPTO_LEVEL);

  return new Promise<string>((resolve, reject) => {
    const dataToSignStream = createReadStream(dataToSignFilePath, { encoding: 'binary' });
    dataToSignStream.pipe(signApi);
    dataToSignStream.on('end', () => resolve(signApi.sign(privateKey, 'base64')));

    dataToSignStream.on('error', (err) => reject(err));
  });
};

const verify = async (dataToSignFilePath: string, publicKey: string, signature: string): Promise<boolean> =>
  new Promise<boolean>((resolve, reject) => {
    const verifier = createVerify(CRYPTO_LEVEL);
    const dataToVerifyStream = createReadStream(dataToSignFilePath, { encoding: 'binary' });
    dataToVerifyStream.pipe(verifier);
    dataToVerifyStream.on('end', () => {
      if (verifier.verify(publicKey, signature, 'base64')) {
        return resolve(true);
      }
      return reject('The signature did not verify');
    });

    dataToVerifyStream.on('error', (err) => reject(err));
  });
