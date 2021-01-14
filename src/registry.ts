/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-underscore-dangle */

import { URL } from 'url';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'shelljs';
import { fs, SfdxError } from '@salesforce/core';
import { Env } from '@salesforce/kit';

export class Registry {
  public get registryEntryLocal(): string {
    return this._registryEntryLocal;
  }

  public get registryEntryGlobal(): string {
    return this._registryEntryGlobal;
  }

  public get registryUrl(): string {
    return this._registryUrl;
  }

  public get authToken(): string {
    return this._authToken;
  }
  private _registryEntryLocal: string;
  private _registryEntryGlobal: string;
  private env: Env;

  public constructor(private _registryUrl?, private _authToken?: string) {
    this.init();
    this.loadNpmConfigs();
  }

  /**
   * Return a properly formatted --registry string
   */
  public getRegistryParameter(): string {
    return `--registry ${this.registryUrl}`;
  }

  /**
   * Compare this.registryUrl against npm configs and write registry entry "registry" entry to <packageDir>/.npmrc
   * if either is not equal
   *
   * @param packageDirectory
   */
  public async setNpmRegistry(packageDirectory: string): Promise<void> {
    if (this.registryEntryLocal !== this.registryUrl || this.registryEntryGlobal !== this.registryUrl) {
      let npmrc: string[] = await this.readNpmrc(packageDirectory);
      npmrc = npmrc.map((line) => {
        if (line.includes('registry=')) {
          if (line.endsWith(this.registryUrl)) return line;
          return `registry=${this.registryUrl}`;
        }
        return line;
      });
      await this.writeNpmrc(packageDirectory, npmrc);
    }
  }

  /**
   * Examine the current npm configs to see if the registry has
   * the authToken set.
   * If not write the authToken to <packageDir>/.npmrc
   *
   * @param packageDirectory
   */
  public async setNpmAuth(packageDirectory: string): Promise<void> {
    if (!this.authToken) {
      throw new SfdxError('auth token has not been set');
    }
    let npmrc: string[] = await this.readNpmrc(packageDirectory);
    const normalizedRegistry = this.normalizeRegistryUrl();
    if (npmrc.find((line) => line.includes('_authToken'))) {
      npmrc = npmrc.map((line) => {
        if (line.includes('_authToken')) {
          if (line.includes(normalizedRegistry)) return line;
          return `${normalizedRegistry}:_authToken="${this.authToken}"${os.EOL}unsafe-perm = true`;
        }
        return line;
      });
    } else {
      npmrc.push(`${normalizedRegistry}:_authToken="${this.authToken}"${os.EOL}unsafe-perm = true`);
    }
    await this.writeNpmrc(packageDirectory, npmrc);
  }

  public loadNpmConfigs(): void {
    // check npm configs for registry
    this._registryEntryLocal = exec('npm config get registry', { silent: true }).stdout.trim();
    this._registryEntryGlobal = exec('npm config get registry -g', { silent: true }).stdout.trim();
    if (!this._registryUrl) {
      if (this._registryEntryLocal) {
        this._registryUrl = this._registryEntryLocal;
      } else if (this._registryEntryGlobal) {
        this._registryUrl = this._registryEntryGlobal;
      } else {
        this._registryUrl = 'https://registry.npmjs.org/';
      }
    }
  }

  public async readNpmrc(packageDir: string): Promise<string[]> {
    if (!(await fs.fileExists(path.join(packageDir, '.npmrc')))) {
      return [];
    }

    const npmrc = await fs.readFile(path.join(packageDir, '.npmrc'), 'utf8');
    return npmrc.split(os.EOL);
  }

  public async writeNpmrc(packageDir: string, npmrc: string[]): Promise<void> {
    await fs.writeFile(path.join(packageDir, '.npmrc'), npmrc.join(os.EOL), 'utf8');
  }

  private normalizeRegistryUrl(): string {
    const registryDomain = new URL(this._registryUrl);
    return `//${registryDomain.host}/`;
  }

  private init(): void {
    this.env = new Env();
    this._registryUrl = this.env.getString('NPM_REGISTRY') ?? this.registryUrl;
    this._authToken = this.env.getString('NPM_TOKEN') ?? this.authToken;
  }
}
