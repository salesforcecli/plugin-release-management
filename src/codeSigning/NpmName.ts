/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NamedError } from '@salesforce/kit';

const DEFAULT_TAG = 'latest';
interface NpmNameResponse {
  scope?: string;
  name: string;
  tag: string;
}

/**
 * Get the parsed components of an NpmName
 *
 * @example
 * const f = parseNpmName('@salesforce/jj@foo');
 * console.log(f.tag === 'foo')
 * console.log(f.name === 'jj')
 * console.log(f.scope === 'salesforce')
 */

export const parseNpmName = (npmName: string): NpmNameResponse => {
  if (!npmName || npmName.length < 1) {
    throw new NamedError('MissingOrInvalidNpmName', 'The npm name is missing or invalid.');
  }

  const components = npmName.split('@');

  // salesforce/jj
  if (components.length === 1) {
    return setNameAndScope(components[0]);
  }

  if (components[0].includes('/')) {
    // salesforce/jj@tag
    return setNameAndScope(components[0], components.length > 2 ? components[2] : DEFAULT_TAG);
  } else if (components[1].includes('/')) {
    // @salesforce/jj@tag
    return setNameAndScope(components[1], components.length > 2 ? components[2] : DEFAULT_TAG);
  } else {
    // Allow something like salesforcedx/pre-release
    return setNameAndScope(components[0], components[1]);
  }
};

/**
 * Subroutine for getting name and scope
 *
 * @param {string} name - The string to parse.
 */
const setNameAndScope = (name: string, tag = DEFAULT_TAG): NpmNameResponse => {
  // There are at least 2 components. So there is likely a scope.
  const subComponents: string[] = name.split('/');
  if (subComponents.length === 2 && subComponents[0].trim().length > 0 && subComponents[1].trim().length > 0) {
    return {
      tag,
      scope: validateComponentString(subComponents[0]),
      name: validateComponentString(subComponents[1]),
    };
  } else if (subComponents.length === 1) {
    return {
      tag,
      name: validateComponentString(subComponents[0]),
    };
  } else {
    throw new NamedError('InvalidNpmName', 'The npm name is invalid.');
  }
};

/**
 * Validate a component part that it's not empty and return it trimmed.
 *
 * @param {string} name The component to validate.
 * @return {string} A whitespace trimmed version of the component.
 */
const validateComponentString = (name: string): string => {
  const trimmedName = name.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName;
  } else {
    throw new NamedError('MissingOrInvalidNpmName', 'The npm name is missing or invalid.');
  }
};
