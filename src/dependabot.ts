/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { parseJson } from '@salesforce/kit';
import { ensureString, isString } from '@salesforce/ts-types';
import { PackageJson } from './package';

Messages.importMessagesDirectory(__dirname);
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
