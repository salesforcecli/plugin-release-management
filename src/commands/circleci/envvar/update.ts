/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { fstat } from 'fs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { isArray, isString, Dictionary, AnyJson, getArray } from '@salesforce/ts-types';
import { env } from '@salesforce/kit';
import got, { Response } from 'got';
import { green, red, bold, cyan, yellow } from 'chalk';
import { api } from '../../../codeSigning/packAndSign';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'circleci');

const URL_BASE = 'https://circleci.com/api/v2/project';

export type EnvvarUpdateStatus = {
  name: string;
  message?: string;
  success: boolean;
};

export type CircelCIEnvvarUpdateStatus = Dictionary<string | EnvvarUpdateStatus[]>;

export default class CircelCIEnvvarUpdate extends SfdxCommand {
  public static readonly description = messages.getMessage('envvar.update.description');
  public static readonly examples = messages.getMessage('envvar.update.examples').split(EOL);

  public static readonly flagsConfig: FlagsConfig = {
    slug: flags.string({
      description: messages.getMessage('envvar.update.flags.slug'),
      char: 's',
      multiple: true,
    }),
    envvar: flags.string({
      description: messages.getMessage('envvar.update.flags.envvar'),
      char: 'e',
      required: true,
      multiple: true,
    }),
    dryrun: flags.boolean({
      description: messages.getMessage('envvar.update.flags.dryrun'),
    }),
  };

  private envvarValues: { [index: string]: string } = {};

  public async run(): Promise<CircelCIEnvvarUpdateStatus> {
    if (this.flags.dryrun) {
      this.ux.log(
        yellow('Dryrun mode set. All validation will occur but the environment variables will NOT be updated.') + EOL
      );
    }

    const slugs: string[] = await this.resolveSlugs();

    await this.resolveEnvvarValues();

    const status: CircelCIEnvvarUpdateStatus = {};
    for (const slug of slugs) {
      const batch = await this.updateEnvvars(slug);
      status[slug] = batch;
      this.printStatus(slug, batch);
    }

    return status;
  }

  private get headers(): { [index: string]: string } {
    const token = env.getString('CIRCLE_CI_TOKEN');
    if (!token) {
      throw new SfdxError('The environment variable "CIRCLE_CI_TOKEN" is required.');
    }
    return {
      'Circle-Token': token,
    };
  }

  private async resolveEnvvarValues(): Promise<void> {
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

  private async updateEnvvars(slug: string): Promise<string | EnvvarUpdateStatus[]> {
    const envvarNames: string[] = this.getFlagAsArray('envvar');
    let response: Response<string>;

    try {
      const url = `${URL_BASE}/${slug}/envvar`;
      const agent = api.getAgentForUri(url);
      response = await got.get<string>(url, { headers: this.headers, agent });
    } catch (err) {
      const error = err as SfdxError;
      return `${error.message}. Skipping...`;
    }
    const body = JSON.parse(response.body) as { items: [{ name: string }] };
    const existingEnvvars = body.items;

    const notFoundEnvvars = envvarNames.filter(
      (envvarName) => !existingEnvvars.find((existingEnvvar) => existingEnvvar.name === envvarName)
    );

    if (notFoundEnvvars.length > 0) {
      const envvarList = envvarNames.join(', ');
      const notFoundList = notFoundEnvvars.join(', ');
      return `Envvars [${envvarList}] not set. ALL specified envvars [${notFoundList}] must be set on the slug. Skipping...`;
    }

    const status: EnvvarUpdateStatus[] = [];
    for (const name of envvarNames) {
      status.push(await this.updateEnvvar(slug, name, this.envvarValues[name]));
    }
    return status;
  }

  private printStatus(slug: string, status: string | EnvvarUpdateStatus[]): void {
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

  private async updateEnvvar(slug: string, name: string, value: string): Promise<EnvvarUpdateStatus> {
    const envvarUrl = `${URL_BASE}/${slug}/envvar`;

    // Only try to delete and create if we are doing an actual run
    if (!this.flags.dryrun) {
      try {
        // First remove the old envvar
        const url = `${envvarUrl}/${name}`;
        let agent = api.getAgentForUri(url);
        await got.delete(url, { headers: this.headers, agent });

        agent = api.getAgentForUri(`${envvarUrl}`);
        await got.post(`${envvarUrl}`, {
          headers: this.headers,
          json: { name, value },
        });
      } catch (err) {
        const error = err as SfdxError;
        return { name, success: false, message: error.message };
      }
    }

    return { name, success: true };
  }

  private async resolveSlugs(): Promise<string[]> {
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

  private getFlagAsArray(name: string): string[] {
    const value = this.flags[name] as string | string[];
    if (isArray<string>(value)) {
      return value;
    } else if (value) {
      return [value];
    } else {
      return [];
    }
  }

  // These methods are to support piping. When OCLIF supports piping, this can be removed.
  private async isPipedIn(): Promise<boolean> {
    return new Promise((resolve) => {
      fstat(0, (err, stats) => {
        if (err) resolve(false);
        else resolve(stats.isFIFO());
      });
    });
  }

  private async readPipedInput(): Promise<string> {
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
}
