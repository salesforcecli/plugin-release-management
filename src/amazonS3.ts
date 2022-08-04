/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { CliUx } from '@oclif/core';
import got, { Agents } from 'got';
import { SfError } from '@salesforce/core';
import * as chalk from 'chalk';
import * as AWS from 'aws-sdk';
import { S3, WebIdentityCredentials } from 'aws-sdk';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { CommonPrefixList, ObjectList } from 'aws-sdk/clients/s3';
import { GetObjectRequest, GetObjectOutput } from 'aws-sdk/clients/s3';
import { Channel, CLI, S3Manifest, ServiceAvailability } from './types';
import { api } from './codeSigning/packAndSign';
import ClientConfiguration = WebIdentityCredentials.ClientConfiguration;

export const BASE_URL = 'https://developer.salesforce.com';
const BUCKET = 'dfc-data-production';

export type GetObjectOption = Omit<GetObjectRequest, 'Bucket'>;

export type AmazonS3Options = {
  bucket?: string;
  cli?: CLI;
  channel?: Channel;
  baseUrl?: string;
  credentials?: CredentialsOptions;
  baseKey?: string;
};

export class AmazonS3 {
  public static STATUS_URL = 'https://s3.amazonaws.com';

  public directory: string;
  private s3: S3;
  private baseKey: string;

  public constructor(private options: AmazonS3Options) {
    this.directory = `https://developer.salesforce.com/media/salesforce-cli/${this.options.cli || ''}`;
    this.baseKey = this.directory.replace(BASE_URL, '').replace(/^\//, '');
    const agent = api.getAgentForUri('https://s3.amazonaws.com') as Agents;
    this.s3 = new AWS.S3({
      ...this.resolveCredentials(),
      httpOptions: { agent: agent.http },
    } as ClientConfiguration);
  }

  public async ping(): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(AmazonS3.STATUS_URL);
    return { service: 'Amazon S3', available: statusCode >= 200 && statusCode < 300 };
  }

  public async fileIsAvailable(url: string): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(url, { throwHttpErrors: false });
    return { service: 'file', name: url, available: statusCode >= 200 && statusCode < 300 };
  }

  public async download(url: string, location: string, silent = false): Promise<void> {
    const downloadStream = got.stream(url);
    const fileWriterStream = fs.createWriteStream(location);
    return new Promise((resolve) => {
      downloadStream.on('error', (error) => {
        if (!silent) CliUx.ux.error(`Download failed: ${error.message}`);
      });

      fileWriterStream
        .on('error', (error) => {
          if (!silent) CliUx.ux.action.stop('Failed');
          if (!silent) CliUx.ux.error(`Could not write file to system: ${error.message}`);
        })
        .on('finish', () => {
          if (!silent) CliUx.ux.action.stop();
          resolve();
        });
      if (!silent) CliUx.ux.action.start(`Downloading ${chalk.cyan(url)}`);
      downloadStream.pipe(fileWriterStream);
    });
  }

  public async getManifestFromChannel(channel: string): Promise<S3Manifest> {
    const url = `${this.directory}/channels/${channel}/${this.options.cli}-darwin-x64-buildmanifest`;
    const filename = await this.getFileAtUrl(url);
    return JSON.parse(fs.readFileSync(filename, 'utf8')) as S3Manifest;
  }

  public async getManifestFromVersion(version: string, sha: string): Promise<S3Manifest> {
    const url = `${this.directory}/versions/${version}/${sha}/${this.options.cli}-v${version}-darwin-x64-buildmanifest`;
    const filename = await this.getFileAtUrl(url);
    return JSON.parse(fs.readFileSync(filename, 'utf8')) as S3Manifest;
  }

  public async getFileAtUrl(url: string): Promise<string> {
    const availability = await this.fileIsAvailable(url);
    if (availability.available) {
      const filename = path.join(os.tmpdir(), `file${Math.random()}`);
      await this.download(url, filename, true);
      return filename;
    } else {
      throw new SfError(`File at url: ${url} does not exist`);
    }
  }

  public async getObject(options: GetObjectOption): Promise<GetObjectOutput> {
    options.Key = options.Key.replace(BASE_URL, '').replace(/^\//, '');
    const object = (await this.s3
      .getObject({ ...options, ...{ Bucket: this.options.bucket || BUCKET } })
      .promise()) as GetObjectOutput;
    return object;
  }

  public async listCommonPrefixes(key: string): Promise<CommonPrefixList> {
    const prefix = key.startsWith(this.baseKey) ? key : `${this.baseKey}/${key}/`;
    const objects = await this.s3
      .listObjectsV2({ Bucket: this.options.bucket || BUCKET, Delimiter: '/', Prefix: prefix })
      .promise();
    return objects.CommonPrefixes;
  }

  public async listKeyContents(key: string, filter = (entry): boolean => !!entry): Promise<ObjectList[]> {
    const prefix = key.startsWith(this.baseKey) ? key : `${this.baseKey}/${key}/`;
    const objects = await this.s3
      .listObjectsV2({ Bucket: this.options.bucket || BUCKET, Delimiter: '/', Prefix: prefix })
      .promise();
    return objects.Contents.filter(filter) as ObjectList[];
  }

  private resolveCredentials(): { credentials: CredentialsOptions } | Record<string, string> {
    const credentials: { credentials: CredentialsOptions } | Record<string, string> = {};
    if (this.options.credentials) {
      return { credentials: this.options.credentials };
    }
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
      };
    }
    return credentials;
  }
}
