/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { Dictionary } from '@salesforce/ts-types';
import got from 'got';
import { yellow } from 'chalk';
import { CircleCiEnvvars, EnvvarModificationStatus } from '../../../circleCiEnvvars';
import { api } from '../../../codeSigning/packAndSign';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'circleci');

const URL_BASE = 'https://circleci.com/api/v2/project';

export type CircelCIEnvvarUpdateStatus = Dictionary<string | EnvvarModificationStatus[]>;

export default class CircleCIEnvvarUpdate extends CircleCiEnvvars {
  public static readonly description = messages.getMessage('envvar.update.description');
  public static readonly examples = messages.getMessage('envvar.update.examples').split(EOL);

  public static readonly flagsConfig: FlagsConfig = {
    slug: flags.string({
      description: messages.getMessage('envvar.flags.slug'),
      char: 's',
      multiple: true,
    }),
    envvar: flags.string({
      description: messages.getMessage('envvar.flags.envvar'),
      char: 'e',
      required: true,
      multiple: true,
    }),
    dryrun: flags.boolean({
      description: messages.getMessage('envvar.flags.dryrun'),
    }),
  };

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

  public async isPipedIn(): Promise<boolean> {
    return await super.isPipedIn();
  }

  public async readPipedInput(): Promise<string> {
    return await super.readPipedInput();
  }

  private async updateEnvvars(slug: string): Promise<string | EnvvarModificationStatus[]> {
    const envvarNames: string[] = this.getFlagAsArray('envvar');
    try {
      const existingEnvvars = await this.getCircleCiEnvvars(slug);

      const notFoundEnvvars = envvarNames.filter(
        (envvarName) => !existingEnvvars.find((existingEnvvar) => existingEnvvar.name === envvarName)
      );

      if (notFoundEnvvars.length > 0) {
        const envvarList = envvarNames.join(', ');
        const notFoundList = notFoundEnvvars.join(', ');
        return `Envvars [${envvarList}] not set. ALL specified envvars [${notFoundList}] must be set on the slug. Skipping...`;
      }

      const status: EnvvarModificationStatus[] = [];
      for (const name of envvarNames) {
        status.push(await this.updateEnvvar(slug, name, this.envvarValues[name]));
      }
      return status;
    } catch (err) {
      const error = err as SfdxError;
      return `${error.message}. Skipping...`;
    }
  }

  private async updateEnvvar(slug: string, name: string, value: string): Promise<EnvvarModificationStatus> {
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
          agent,
        });
      } catch (err) {
        const error = err as SfdxError;
        return { name, success: false, message: error.message };
      }
    }

    return { name, success: true };
  }
}
