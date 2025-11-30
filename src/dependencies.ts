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
import { Env } from '@salesforce/kit';
import { OutputFlags } from '@oclif/core/parser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Flags = OutputFlags<any>;
type ConditionFn = (flags: Flags) => boolean;
type DependencyType = 'env';

type Dependency = {
  name: string;
  type: DependencyType;
  condition?: ConditionFn;
};

type Result = {
  name: string;
  type: DependencyType;
  passed: boolean;
  message?: string;
};

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

/**
 *
 * @param args that flags being validated
 * @param depFilter a filter function that runs on the above DEPENDENCIES
 * @param condition a function that runs on the args
 * @returns
 */
export function verifyDependencies<A extends Flags>(
  args: A,
  depFilter = (dep: Dependency): boolean => !!dep,
  condition = (a: A): boolean => !!a && false
): { failures: number; results: Result[] } {
  const env = new Env();
  const results: Result[] = [];
  for (const dep of DEPENDENCIES.filter(depFilter)) {
    const result: Result = {
      name: dep.name,
      type: dep.type,
      passed: true,
    };
    if (condition(args) || dep.condition?.(args)) {
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
