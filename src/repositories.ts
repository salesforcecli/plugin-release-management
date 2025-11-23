/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import got from 'got';
import { api } from './codeSigning/packAndSign.js';

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
  const response = await got.get(KNOWN_REPOSITORIES_URL, agent ? { agent } : {});
  const repositories = JSON.parse(response.body) as SourceRepositoryDefinition[];

  return repositories.map((repository) => {
    const [, organization, name] = /https:\/\/github.com\/([\w_-]+)\/([\w_-]+)/.exec(repository.url) ?? [];
    const packages = repository.packages.map((pkg) =>
      Object.assign(pkg, { url: `${PACKAGE_REGISTRY_BASE_URL}/${pkg.name}` })
    );
    return Object.assign({ organization, name, packages }, repository);
  });
};
