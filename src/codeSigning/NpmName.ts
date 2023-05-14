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
 * String representing the parsed components of an NpmName
 *
 * @example
 * const f: NpmName = NpmName.parse('@salesforce/jj@foo');
 * console.log(f.tag === 'foo')
 */
// export class NpmName {
//   public static readonly DEFAULT_TAG = 'latest';
//   public tag: string;
//   public scope: string;
//   public name: string;

//   /**
//    * Private ctor. Use static parse method.
//    */
//   private constructor() {
//     this.tag = NpmName.DEFAULT_TAG;
//   }

//   /**
//    * Parse an NPM package name into {scope, name, tag}. The tag is 'latest' by default and can be any semver string.
//    *
//    * @param {string} npmName - The npm name to parse.
//    * @return {NpmName} - An object with the parsed components.
//    */
//   public static parse(npmName: string): NpmName {
//     if (!npmName || npmName.length < 1) {
//       throw new NamedError('MissingOrInvalidNpmName', 'The npm name is missing or invalid.');
//     }

//     const returnNpmName = new NpmName();

//     const components = npmName.split('@');

//     // salesforce/jj
//     if (components.length === 1) {
//       NpmName.setNameAndScope(components[0], returnNpmName);
//       return returnNpmName;
//     }

//     if (components[0].includes('/')) {
//       // salesforce/jj@tag
//       NpmName.setNameAndScope(components[0], returnNpmName);
//     } else if (components[1].includes('/')) {
//       // @salesforce/jj@tag
//       NpmName.setNameAndScope(components[1], returnNpmName);
//     } else {
//       // Allow something like salesforcedx/pre-release
//       NpmName.setNameAndScope(components[0], returnNpmName);
//       returnNpmName.tag = components[1];
//     }

//     if (components.length > 2) {
//       returnNpmName.tag = components[2];
//     }
//     return returnNpmName;
//   }
// }

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
