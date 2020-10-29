/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as glob from 'glob';
import { pwd } from 'shelljs';
import { AnyJson } from '@salesforce/ts-types';
import { fs } from '@salesforce/core';

export type LernaJson = {
  packages?: string[];
} & AnyJson;

export async function isMonoRepo(): Promise<boolean> {
  return fs.fileExists('lerna.json');
}

export async function readLernaJson(): Promise<LernaJson> {
  return (await fs.readJson('lerna.json')) as LernaJson;
}

export async function getListOfPackages(): Promise<string[]> {
  const lerna = await isMonoRepo();
  const workingDir = pwd().stdout;
  if (lerna) {
    const lernaJson = await readLernaJson();
    const packageGlobs = lernaJson.packages || ['*'];
    const packages = packageGlobs
      .map((pGlob) => glob.sync(pGlob))
      .reduce((x, y) => x.concat(y), [])
      .map((pkg) => path.join(workingDir, pkg));
    return packages;
  } else {
    return [workingDir];
  }
}
