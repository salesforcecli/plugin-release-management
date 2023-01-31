/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Env } from '@salesforce/kit';
import { OutputFlags } from '@oclif/core/lib/interfaces/parser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Flags = OutputFlags<any>;
type ConditionFn = (flags: Flags) => boolean;
type DependencyType = 'env';

interface Dependency {
  name: string;
  type: DependencyType;
  condition?: ConditionFn;
}

interface Result {
  name: string;
  type: DependencyType;
  passed: boolean;
  message?: string;
}

const DEPENDENCIES: Dependency[] = [
  {
    name: 'AWS_ACCESS_KEY_ID',
    type: 'env',
    condition: (flags): boolean => !!flags.sign,
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    type: 'env',
    condition: (flags): boolean => !!flags.sign,
  },
  {
    name: 'NPM_TOKEN',
    type: 'env',
    condition: (flags): boolean => !flags.dryrun,
  },
  {
    name: 'GH_TOKEN',
    type: 'env',
    condition: (flags): boolean => !!flags.githubrelease,
  },
];

export function verifyDependencies(
  args: Flags,
  depFilter = (dep: Dependency): boolean => !!dep,
  condition = (a): boolean => !!a && false
): { failures: number; results: Result[] } {
  const env = new Env();
  const results: Result[] = [];
  for (const dep of DEPENDENCIES.filter(depFilter)) {
    const result: Result = {
      name: dep.name,
      type: dep.type,
      passed: true,
    };
    if (condition(args) || dep.condition(args)) {
      result.passed = !!env.getString(dep.name);
      if (!result.passed) {
        result.message = `Set ${dep.name} environment variable`;
      }
    }
    results.push(result);
  }
  const failures = results.filter((r) => r.passed === false).length;
  return { failures, results };
}
