/*
 * Copyright 2026, Salesforce, Inc.
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

import { URL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import shelljs from 'shelljs';
import { SfError } from '@salesforce/core';
import { Env } from '@salesforce/kit';

export class Registry {
  public registryEntryLocal: string;
  public registryEntryGlobal: string;
  private env: Env;

  public constructor(public registryUrl?: string, public authToken?: string) {
    this.env = new Env();
    this.registryUrl = this.env.getString('NPM_REGISTRY') ?? this.registryUrl;
    this.authToken = this.env.getString('NPM_TOKEN') ?? this.authToken;
    this.registryEntryLocal = shelljs.exec('npm config get registry', { silent: true }).stdout.trim();
    this.registryEntryGlobal = shelljs.exec('npm config get registry -g', { silent: true }).stdout.trim();
    this.loadNpmConfigs();
  }

  /**
   * Return a properly formatted --registry string
   */
  public getRegistryParameter(): string {
    if (!this.registryUrl) {
      throw new SfError('registry is not set');
    }
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
            if (this.registryUrl && line.endsWith(this.registryUrl)) return line;
            return `registry=${this.registryUrl ?? ''}`;
          }
          return line;
        });
      } else {
        npmrc.push(`registry=${this.registryUrl ?? ''}`);
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
          return `${normalizedRegistry}:_authToken="${this.authToken ?? ''}"`;
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

  // eslint-disable-next-line class-methods-use-this
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

  // eslint-disable-next-line class-methods-use-this
  public async writeNpmrc(packageDir: string, npmrc: string[]): Promise<void> {
    const npmrcLines = [...new Set(npmrc).values()].filter((line) => line?.length);
    await fs.writeFile(path.join(packageDir, '.npmrc'), npmrcLines.join(os.EOL), 'utf8');
  }

  private normalizeRegistryUrl(): string {
    if (!this.registryUrl) throw new SfError('registry is not set');
    const registryDomain = new URL(this.registryUrl);
    const pathPart = registryDomain.pathname?.length ? `${registryDomain.pathname.replace(/\/$/, '')}` : '';
    return `//${registryDomain.host}${pathPart}/`;
  }
}
