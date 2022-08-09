/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfError } from '@salesforce/core';
import { Dictionary } from '@salesforce/ts-types';
import got from 'got';
import { yellow } from 'chalk';
import { CircleCiEnvvars, EnvvarModificationStatus } from '../../../circleCiEnvvars';
import { api } from '../../../codeSigning/packAndSign';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'circleci');

const URL_BASE = 'https://circleci.com/api/v2/project';

export type CircelCIEnvvarCreateStatus = Dictionary<string | EnvvarModificationStatus[]>;

export default class CircleCIEnvvarCreate extends CircleCiEnvvars {
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

  public async run(): Promise<CircelCIEnvvarCreateStatus> {
    if (this.flags.dryrun) {
      this.ux.log(
        yellow('Dryrun mode set. All validation will occur but the environment variables will NOT be updated.') + EOL
      );
    }

    const slugs: string[] = await this.resolveSlugs();

    await this.resolveEnvvarValues();

    const status: CircelCIEnvvarCreateStatus = {};
    for (const slug of slugs) {
      const batch = await this.createEnvvars(slug);
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

  private async createEnvvars(slug: string): Promise<string | EnvvarModificationStatus[]> {
    const envvarNames: string[] = this.getFlagAsArray('envvar');
    try {
      const existingEnvvars = await this.getCircleCiEnvvars(slug);
      const foundEnvvars = envvarNames.filter((envvarName) =>
        existingEnvvars.find((existingEnvvar) => existingEnvvar.name === envvarName)
      );

      if (foundEnvvars.length > 0) {
        const envvarList = envvarNames.join(', ');
        const foundList = foundEnvvars.join(', ');
        return `Envvars [${envvarList}] are already set. ALL specified envvars [${foundList}] cannot be set on the slug. Skipping...`;
      }

      const status: EnvvarModificationStatus[] = [];
      for (const name of envvarNames) {
        status.push(await this.createEnvvar(slug, name, this.envvarValues[name]));
      }
      return status;
    } catch (err) {
      const error = err as SfError;
      return `${error.message}. Skipping...`;
    }
  }

  private async createEnvvar(slug: string, name: string, value: string): Promise<EnvvarModificationStatus> {
    const envvarUrl = `${URL_BASE}/${slug}/envvar`;

    // Only try to delete and create if we are doing an actual run
    if (!this.flags.dryrun) {
      try {
        const agent = api.getAgentForUri(envvarUrl);
        await got.post(`${envvarUrl}`, {
          headers: this.headers,
          json: { name, value },
          agent,
        });
      } catch (err) {
        const error = err as SfError;
        return { name, success: false, message: error.message };
      }
    }

    return { name, success: true };
  }
}
