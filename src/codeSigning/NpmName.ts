/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NamedError } from '@salesforce/kit';

interface NpmNameResponse {
  scope: string;
  name: string;
}

/**
 * String representing the parsed components of an NpmName
 *
 * @example
 * const f: NpmName = NpmName.parse('@salesforce/jj@foo');
 * console.log(f.tag === 'foo')
 */
export class NpmName {
  public static readonly DEFAULT_TAG = 'latest';
  public scope: string;
  public tag: string;
  public name: string;

  /**
   * Private ctor. Use static parse method.
   */
  private constructor() {
    this.tag = NpmName.DEFAULT_TAG;
  }

  /**
   * Parse an NPM package name into {scope, name, tag}. The tag is 'latest' by default and can be any semver string.
   *
   * @param {string} npmName - The npm name to parse.
   * @return {NpmName} - An object with the parsed components.
   */
  public static parse(npmName: string): NpmName {
    if (!npmName || npmName.length < 1) {
      throw new NamedError('MissingOrInvalidNpmName', 'The npm name is missing or invalid.');
    }

    const returnNpmName = new NpmName();

    const components: string[] = npmName.split('@');

    // salesforce/jj
    if (components.length === 1) {
      NpmName.setNameAndScope(components[0], returnNpmName);
    } else {
      // salesforce/jj@tag
      if (components[0].includes('/')) {
        NpmName.setNameAndScope(components[0], returnNpmName);
      } else {
        // @salesforce/jj@tag
        if (components[1].includes('/')) {
          NpmName.setNameAndScope(components[1], returnNpmName);
        } else {
          // Allow something like salesforcedx/pre-release
          NpmName.setNameAndScope(components[0], returnNpmName);
          returnNpmName.tag = components[1];
        }
      }
    }

    if (components.length > 2) {
      returnNpmName.tag = components[2];
    }
    return returnNpmName;
  }

  /**
   * Static helper to parse the name and scope.
   *
   * @param {string} name - The string to parse.
   * @param returnNpmName - The object to update.
   */
  private static setNameAndScope(name: string, returnNpmName: NpmNameResponse): void {
    // There are at least 2 components. So there is likely a scope.
    const subComponents: string[] = name.split('/');
    if (subComponents.length === 2 && subComponents[0].trim().length > 0 && subComponents[1].trim().length > 0) {
      returnNpmName.scope = NpmName.validateComponentString(subComponents[0]);
      returnNpmName.name = NpmName.validateComponentString(subComponents[1]);
    } else if (subComponents.length === 1) {
      returnNpmName.name = NpmName.validateComponentString(subComponents[0]);
    } else {
      throw new NamedError('InvalidNpmName', 'The npm name is invalid.');
    }
  }

  /**
   * Validate a component part that it's not empty and return it trimmed.
   *
   * @param {string} name The component to validate.
   * @return {string} A whitespace trimmed version of the component.
   */
  private static validateComponentString(name: string): string {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName.length > 0) {
      return trimmedName;
    } else {
      throw new NamedError('MissingOrInvalidNpmName', 'The npm name is missing or invalid.');
    }
  }

  /**
   * Produce a string that can be used by npm. @salesforce/jj@1.2.3 becomes "salesforce-jj-1.2.3.tgz
   *
   * @param {string} [ext = tgz] The file extension to use.
   * @param {boolean} includeLatestTag - True if the "latest" tag should be used. Generally you wouldn't do this.
   * @return {string} Formatted npm string thats compatible with the npm utility
   */
  public toFilename(ext = 'tgz', includeLatestTag?: boolean): string {
    const nameComponents: string[] = [];

    if (this.scope) {
      nameComponents.push(this.scope);
    }

    nameComponents.push(this.name);

    if (this.tag) {
      if (this.tag !== NpmName.DEFAULT_TAG) {
        nameComponents.push(this.tag);
      } else if (includeLatestTag) {
        nameComponents.push(this.tag);
      }
    }

    return nameComponents.join('-').concat(ext.startsWith('.') ? ext : `.${ext}`);
  }

  /**
   * Produces a formatted string version of the object.
   *
   * @return {string} A formatted string version of the object.
   */
  public toString(includeTag = false): string {
    const nameComponents: string[] = [];
    if (this.scope && this.scope.length > 0) {
      nameComponents.push(`@${this.scope}/`);
    }

    nameComponents.push(this.name);

    if (includeTag && this.tag && this.tag.length > 0) {
      nameComponents.push(`@${this.tag}`);
    }

    return nameComponents.join('');
  }
}
