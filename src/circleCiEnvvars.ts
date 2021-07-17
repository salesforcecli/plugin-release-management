/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fstat } from 'fs';
import { EOL } from 'os';
import { SfdxCommand } from '@salesforce/command';
import { env } from '@salesforce/kit';
import { SfdxError } from '@salesforce/core';
import { AnyJson, getArray, isArray, isString } from '@salesforce/ts-types';
import got, { Response } from 'got';
import { bold, cyan, green, red } from 'chalk';

const URL_BASE = 'https://circleci.com/api/v2/project';

export type EnvvarModificationStatus = {
  name: string;
  message?: string;
  success: boolean;
};

export abstract class CircleCiEnvvars extends SfdxCommand {
  protected envvarValues: { [index: string]: string } = {};

  protected get headers(): { [index: string]: string } {
    const token = env.getString('CIRCLE_CI_TOKEN');
    if (!token) {
      throw new SfdxError('The environment variable "CIRCLE_CI_TOKEN" is required.');
    }
    return {
      'Circle-Token': token,
    };
  }

  protected async resolveEnvvarValues(): Promise<void> {
    for (const envvarName of this.getFlagAsArray('envvar')) {
      const envvarValue = env.getString(envvarName);
      if (envvarValue) {
        this.envvarValues[envvarName] = envvarValue;
      } else if (!(await this.isPipedIn())) {
        this.envvarValues[envvarName] = await this.ux.prompt(envvarName, { type: 'mask' });
      } else {
        throw new SfdxError(`missing envvar value for ${envvarName}`);
      }
    }
  }

  protected async resolveSlugs(): Promise<string[]> {
    let slugs: string[] = [];

    if (await this.isPipedIn()) {
      const input = await this.readPipedInput();
      try {
        const json = JSON.parse(input) as AnyJson;
        if (isArray<string>(json)) {
          slugs = json;
        } else if (isArray<string>(getArray(json, 'result', null))) {
          slugs = getArray(json, 'result', []) as string[];
        }
      } catch (error) {
        slugs = input.split('\n');
      }
    }

    slugs = [...slugs, ...this.getFlagAsArray('slug')];

    if (!slugs) {
      throw new SfdxError('missing input slugs');
    }
    return slugs.filter((slug) => !!slug);
  }

  protected async getCircleCiEnvvars(slug: string): Promise<[{ name: string }]> {
    const response: Response<string> = await got.get<string>(`${URL_BASE}/${slug}/envvar`, { headers: this.headers });
    const body = JSON.parse(response.body) as { items: [{ name: string }] };
    return body.items;
  }

  // These methods are to support piping. When OCLIF supports piping, this can be removed.
  protected async isPipedIn(): Promise<boolean> {
    return new Promise((resolve) => {
      fstat(0, (err, stats) => {
        if (err) resolve(false);
        else resolve(stats.isFIFO());
      });
    });
  }

  protected async readPipedInput(): Promise<string> {
    const isPiped = await this.isPipedIn();
    return new Promise((resolve, reject) => {
      if (!isPiped) reject();
      else {
        const stdin = process.stdin;
        stdin.setEncoding('utf-8');

        let data = '';
        stdin.on('data', (chunk) => {
          data += chunk;
        });

        stdin.on('end', () => {
          resolve(data);
        });
      }
    });
  }

  protected getFlagAsArray(name: string): string[] {
    const value = this.flags[name] as string | string[];
    if (isArray<string>(value)) {
      return value;
    } else if (value) {
      return [value];
    } else {
      return [];
    }
  }
  protected printStatus(slug: string, status: string | EnvvarModificationStatus[]): void {
    let message = bold(cyan(slug));

    if (isString(status)) {
      message += `: ${red(status)}`;
    } else {
      message +=
        EOL +
        status
          .map((s) =>
            s.success ? `    ${green('✔')} ${bold(s.name)}` : `    ${red('✘')} ${bold(s.name)}: ${red(s.message)}`
          )
          .join(EOL);
    }
    this.ux.log(message);
  }
}
