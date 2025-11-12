/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ux } from '@oclif/core';
import got from 'got';
import { SfError } from '@salesforce/core';
import chalk from 'chalk';
import { _Object, ListObjectsV2CommandOutput, S3, GetObjectRequest, GetObjectOutput } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { AwsCredentialIdentity } from '@smithy/types';
import { isString } from '@salesforce/ts-types';

import { Channel, CLI, S3Manifest, ServiceAvailability } from './types.js';
import { api } from './codeSigning/packAndSign.js';

const BASE_URL = 'https://developer.salesforce.com';
const BUCKET = 'dfc-data-production';

type GetObjectOption = Omit<GetObjectRequest, 'Bucket'>;

type AmazonS3Options = {
  bucket?: string;
  cli: CLI;
  channel?: Channel;
  baseUrl?: string;
  credentials?: AwsCredentialIdentity;
  baseKey?: string;
};

export class AmazonS3 {
  public static STATUS_URL = 'https://s3.amazonaws.com';

  public directory: string;
  private s3: S3;
  private readonly baseKey: string;

  public constructor(private options: AmazonS3Options) {
    this.directory = `https://developer.salesforce.com/media/salesforce-cli/${this.options.cli ?? ''}`;
    this.baseKey = this.directory.replace(BASE_URL, '').replace(/^\//, '');
    this.s3 = new S3({
      ...resolveCredentials(options.credentials),
      ...buildRequestHandler(),
    });
  }

  // there's an abstract class for cli:install:test using this
  // eslint-disable-next-line class-methods-use-this
  public async ping(): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(AmazonS3.STATUS_URL);
    return { service: 'Amazon S3', available: statusCode >= 200 && statusCode < 300 };
  }
  public async getManifestFromChannel(channel: string): Promise<S3Manifest> {
    const url = `${this.directory}/channels/${channel}/${this.options.cli}-darwin-x64-buildmanifest`;
    const filename = await getFileAtUrl(url);
    return JSON.parse(fs.readFileSync(filename, 'utf8')) as S3Manifest;
  }

  public async getObject(options: GetObjectOption): Promise<GetObjectOutput> {
    return this.s3.getObject({
      ...options,
      Key: options.Key?.replace(BASE_URL, '').replace(/^\//, ''),
      ...{ Bucket: this.options.bucket ?? BUCKET },
    });
  }

  // Paginates listObjectV2 and returns both Contents and CommonPrefixes
  public async listAllObjects(key: string): Promise<{ contents: _Object[]; commonPrefixes: string[] }> {
    const prefix = key.startsWith(this.baseKey) ? key : `${this.baseKey}/${key}/`;
    const bucket = this.options.bucket ?? BUCKET;
    let continuationToken;
    const allContents: _Object[] = [];
    const allCommonPrefixes: string[] = [];

    // Use maximum iteration to ensure termination
    const MAX_ITERATIONS = 100;
    for (let i = 1; i <= MAX_ITERATIONS; i++) {
      // eslint-disable-next-line no-await-in-loop
      const response: ListObjectsV2CommandOutput = await this.s3.listObjectsV2({
        Bucket: bucket,
        Delimiter: '/',
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      if (response.Contents) {
        allContents.push(...response.Contents);
      }
      if (response.CommonPrefixes) {
        allCommonPrefixes.push(...response.CommonPrefixes.map((item) => item.Prefix).filter(isString));
      }

      if (!response.IsTruncated) break;
      if (i === MAX_ITERATIONS) throw new SfError('Max listObjectsV2 iterations reached');

      continuationToken = response.NextContinuationToken;
    }

    return { contents: allContents, commonPrefixes: allCommonPrefixes };
  }

  public async listCommonPrefixes(key: string): Promise<string[]> {
    const result = await this.listAllObjects(key);
    return result.commonPrefixes;
  }

  public async listKeyContents(key: string): Promise<_Object[]> {
    const result = await this.listAllObjects(key);
    return result.contents;
  }
}

export const download = async (url: string, location: string, silent = false): Promise<void> => {
  const downloadStream = got.stream(url);
  const fileWriterStream = fs.createWriteStream(location);
  return new Promise((resolve) => {
    downloadStream.on('error', (error) => {
      if (!silent) ux.error(`Download failed: ${error.message}`);
    });

    fileWriterStream
      .on('error', (error) => {
        if (!silent) ux.action.stop('Failed');
        if (!silent) ux.error(`Could not write file to system: ${error.message}`);
      })
      .on('finish', () => {
        if (!silent) ux.action.stop();
        resolve();
      });
    if (!silent) ux.action.start(`Downloading ${chalk.cyan(url)}`);
    downloadStream.pipe(fileWriterStream);
  });
};

const getFileAtUrl = async (url: string): Promise<string> => {
  const availability = await fileIsAvailable(url);
  if (availability.available) {
    const filename = path.join(os.tmpdir(), `file${Math.random()}`);
    await download(url, filename, true);
    return filename;
  } else {
    throw new SfError(`File at url: ${url} does not exist`);
  }
};

const resolveCredentials = (
  credentialOptions?: AwsCredentialIdentity
): { credentials: AwsCredentialIdentity } | Record<string, string> => {
  if (credentialOptions) {
    return { credentials: credentialOptions };
  }
  return process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
      }
    : {};
};

const fileIsAvailable = async (url: string): Promise<ServiceAvailability> => {
  const { statusCode } = await got.head(url, { throwHttpErrors: false });
  return { service: 'file', name: url, available: statusCode >= 200 && statusCode < 300 };
};

const buildRequestHandler = (): NodeHttpHandler => {
  const agent = api.getAgentForUri('https://s3.amazonaws.com');
  const options =
    agent && agent.http
      ? {
          httpAgent: agent.http,
        }
      : {};
  return new NodeHttpHandler(options);
};
