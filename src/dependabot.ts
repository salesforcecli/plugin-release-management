/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { diff, ReleaseType } from 'semver';
import { flags } from '@salesforce/command';
import { fs, Messages } from '@salesforce/core';
import { ensureString, isString } from '@salesforce/ts-types';
import { PackageJson } from './package';

type BumpType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'dependabot.consolidate');

export const meetsVersionCriteria = (title: string, maxVersionBump: BumpType): boolean => {
  const versionsRegex = /[0-9]+.[0-9]+.[0-9]+/g;
  const [from, to] = title.match(versionsRegex);

  const bumpType = diff(from, to) as BumpType;
  const inclusionMap = {
    major: ['major', 'minor', 'patch'] as BumpType[],
    minor: ['minor', 'patch'] as BumpType[],
    patch: ['patch'] as BumpType[],
  };

  const includeBumps = inclusionMap[maxVersionBump];
  return includeBumps.includes(bumpType);
};

export const maxVersionBumpFlag = flags.enum({
  description: messages.getMessage('maxVersionBump'),
  char: 'm',
  options: ['major', 'minor', 'patch'],
  default: 'minor',
  required: true,
});

export const getOwnerAndRepo = async (
  ownerFlag: string,
  repoFlag: string
): Promise<{ owner: string; repo: string }> => {
  const pkgJson = (await fs.readJson('package.json')) as PackageJson;
  if (pkgJson.repository && isString(pkgJson.repository)) {
    const [owner, repo] = pkgJson.repository?.split('/');
    return { owner, repo };
  } else {
    return {
      owner: ensureString(ownerFlag, 'You must specify an owner'),
      repo: ensureString(repoFlag, 'You must specify a repository'),
    };
  }
};
