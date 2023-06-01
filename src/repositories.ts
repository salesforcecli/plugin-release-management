/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import got from 'got';
import { api } from './codeSigning/packAndSign';

const KNOWN_REPOSITORIES_URL = 'https://raw.githubusercontent.com/salesforcecli/status/main/repositories.json';
const PACKAGE_REGISTRY_BASE_URL = 'https://www.npmjs.com/package';

type SourcePackageDefinition = {
  name: string;
  type: 'package' | 'library' | 'orb';
};

type SourceRepositoryDefinition = {
  url: string;
  packages: SourcePackageDefinition[];
};

export type RepositoryInfo = {
  organization: string;
  name: string;
} & SourceRepositoryDefinition;

/**
 * Get a list of known tooling repositories that include Salesforce CLI plugins, libraries, and orbs.
 */
export const retrieveKnownRepositories = async (): Promise<RepositoryInfo[]> => {
  const agent = api.getAgentForUri(KNOWN_REPOSITORIES_URL);
  const response = await got.get(KNOWN_REPOSITORIES_URL, { agent });
  const repositories = JSON.parse(response.body) as SourceRepositoryDefinition[];

  return repositories.map((repository) => {
    const [, organization, name] = /https:\/\/github.com\/([\w_-]+)\/([\w_-]+)/.exec(repository.url) ?? [];
    const packages = repository.packages.map((pkg) =>
      Object.assign(pkg, { url: `${PACKAGE_REGISTRY_BASE_URL}/${pkg.name}` })
    );
    return Object.assign({ organization, name, packages }, repository);
  });
};
