/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URL } from 'url';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { exec } from 'shelljs';
import { SfError } from '@salesforce/core';
import { Env } from '@salesforce/kit';

export class Registry {
  public registryEntryLocal: string;
  public registryEntryGlobal: string;
  private env: Env;

  public constructor(public registryUrl?: string, public authToken?: string) {
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
      let npmrc = await this.readNpmrc(packageDirectory);
      if (npmrc.find((line) => line.includes('registry='))) {
        npmrc = npmrc.map((line) => {
          if (line.includes('registry=')) {
            if (line.endsWith(this.registryUrl)) return line;
            return `registry=${this.registryUrl}`;
          }
          return line;
        });
      } else {
        npmrc.push(`registry=${this.registryUrl}`);
      }
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
      throw new SfError('auth token has not been set');
    }
    let npmrc: string[] = await this.readNpmrc(packageDirectory);
    const normalizedRegistry = this.normalizeRegistryUrl();
    if (npmrc.find((line) => line.includes('_authToken'))) {
      npmrc = npmrc.map((line) => {
        if (line.includes('_authToken')) {
          if (line.includes(normalizedRegistry)) return line;
          return `${normalizedRegistry}:_authToken="${this.authToken}"`;
        }
        return line;
      });
    } else {
      npmrc.push(`${normalizedRegistry}:_authToken="${this.authToken}"`);
    }
    npmrc.push('unsafe-perm=true');
    await this.writeNpmrc(packageDirectory, npmrc);
  }

  public loadNpmConfigs(): void {
    // check npm configs for registry
    this.registryEntryLocal = exec('npm config get registry', { silent: true }).stdout.trim();
    this.registryEntryGlobal = exec('npm config get registry -g', { silent: true }).stdout.trim();
    if (!this.registryUrl) {
      if (this.registryEntryLocal) {
        this.registryUrl = this.registryEntryLocal;
      } else if (this.registryEntryGlobal) {
        this.registryUrl = this.registryEntryGlobal;
      } else {
        this.registryUrl = 'https://registry.npmjs.org/';
      }
    }
  }

  public async readNpmrc(packageDir: string): Promise<string[]> {
    try {
      // check that `.npmrc` exists
      await fs.access(path.join(packageDir, '.npmrc'));
    } catch (err) {
      return [];
    }

    const npmrc = await fs.readFile(path.join(packageDir, '.npmrc'), 'utf8');
    const npmrcLines: string[] = npmrc.split(os.EOL);
    return [...new Set(npmrcLines).values()].filter((line) => line?.length);
  }

  public async writeNpmrc(packageDir: string, npmrc: string[]): Promise<void> {
    const npmrcLines = [...new Set(npmrc).values()].filter((line) => line?.length);
    await fs.writeFile(path.join(packageDir, '.npmrc'), npmrcLines.join(os.EOL), 'utf8');
  }

  private normalizeRegistryUrl(): string {
    const registryDomain = new URL(this.registryUrl);
    const pathPart = registryDomain.pathname?.length ? `${registryDomain.pathname.replace(/\/$/, '')}` : '';
    return `//${registryDomain.host}${pathPart}/`;
  }

  private init(): void {
    this.env = new Env();
    this.registryUrl = this.env.getString('NPM_REGISTRY') ?? this.registryUrl;
    this.authToken = this.env.getString('NPM_TOKEN') ?? this.authToken;
  }
}
