/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as path from 'path';
import { UX } from '@salesforce/command';
import got from 'got';
import { fs, SfdxError } from '@salesforce/core';
import * as chalk from 'chalk';
import { Channel, CLI, S3Manifest, ServiceAvailability } from './types';

export class AmazonS3 {
  public static STATUS_URL = 'https://s3.amazonaws.com';

  public directory: string;

  public constructor(private cli: CLI, private channel: Channel, private ux: UX) {
    this.directory = `https://developer.salesforce.com/media/salesforce-cli/${cli}/channels/${channel}`;
  }

  public async ping(): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(AmazonS3.STATUS_URL);
    return { service: 'Amazon S3', available: statusCode >= 200 && statusCode < 300 };
  }

  public async fileIsAvailable(url: string): Promise<ServiceAvailability> {
    const { statusCode } = await got.get(url, { throwHttpErrors: false });
    return { service: 'file', name: url, available: statusCode >= 200 && statusCode < 300 };
  }

  public async download(url: string, location: string): Promise<void> {
    const downloadStream = got.stream(url);
    const fileWriterStream = fs.createWriteStream(location);
    return new Promise((resolve) => {
      downloadStream.on('error', (error) => {
        this.ux.error(`Download failed: ${error.message}`);
      });

      fileWriterStream
        .on('error', (error) => {
          this.ux.stopSpinner('Failed');
          this.ux.error(`Could not write file to system: ${error.message}`);
        })
        .on('finish', () => {
          this.ux.stopSpinner();
          resolve();
        });
      this.ux.startSpinner(`Downloading ${chalk.cyan(url)}`);
      downloadStream.pipe(fileWriterStream);
    });
  }

  public async getManifest(): Promise<S3Manifest> {
    const url = `${this.directory}/${this.cli}-darwin-x64-buildmanifest`;
    const availability = await this.fileIsAvailable(url);
    if (availability.available) {
      await this.download(url, path.join(os.tmpdir(), 'manifest.json'));
      return (await fs.readJson(path.join(os.tmpdir(), 'manifest.json'))) as S3Manifest;
    } else {
      throw new SfdxError(`Directory for cli ${this.cli} and channel ${this.channel} is not available`);
    }
  }
}
