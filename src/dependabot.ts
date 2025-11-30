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
import fs from 'node:fs';
import { Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { parseJson } from '@salesforce/kit';
import { ensureString, isString } from '@salesforce/ts-types';
import { PackageJson } from './package.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.consolidate');

export const maxVersionBumpFlag = Flags.string({
  description: messages.getMessage('maxVersionBump'),
  char: 'm',
  options: ['major', 'minor', 'patch'],
  default: 'minor',
  required: true,
});

export const getOwnerAndRepo = async (
  ownerFlag?: string,
  repoFlag?: string
): Promise<{ owner: string; repo: string }> => {
  if (ownerFlag && repoFlag) {
    return { owner: ownerFlag, repo: repoFlag };
  }
  // read it from package.json
  const fileData = await fs.promises.readFile('package.json', 'utf8');
  const pkgJson = parseJson(fileData, 'package.json', false) as PackageJson;

  if (isString(pkgJson.repository)) {
    const [owner, repo] = pkgJson.repository.split('/');
    return { owner, repo };
  } else {
    return {
      owner: ensureString(ownerFlag, 'You must specify an owner'),
      repo: ensureString(repoFlag, 'You must specify a repository'),
    };
  }
};
