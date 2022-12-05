/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as assert from 'assert';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { cp } from 'shelljs';
import * as fg from 'fast-glob';
import { JsonMap } from '@salesforce/ts-types';
import { parseJsonMap } from '@salesforce/kit';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-release-management', 'cli.schemas.collect', [
  'description',
  'examples',
]);

export const getLatestSchemaFiles = async (): Promise<string[]> => {
  const fileData = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8');
  const pjson: { oclif: { plugins: string[] } } = parseJsonMap(fileData, path.join(process.cwd(), 'package.json'));

  const globs = (pjson.oclif?.plugins || []).map((plugin) => {
    const normalized = plugin.replace(/\\/g, '/');
    return `node_modules/${normalized}/schemas/**/*.json`; // We need to use / for path sep since fg only works with Unix paths
  });
  const schemaFiles = (await fg(globs))
    .map((f) => path.normalize(f)) // normalize paths so this will work on Windows since fg only returns Unix paths
    .filter((f) => !f.includes(path.join('@salesforce', 'schemas')));
  return schemaFiles;
};

export const getExistingSchemaFiles = async (): Promise<string[]> => {
  const globs = ['schemas/**/*.json'];
  const schemaFiles = await fg(globs);
  return schemaFiles;
};

export const deepEqual = (a: JsonMap, b: JsonMap): boolean => {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

export default class Collect extends SfCommand<void> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flags = {};

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    const schemaFiles = await getLatestSchemaFiles();
    const schemaFilesByPlugin = new Map<string, string[]>();
    for (const file of schemaFiles) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, namespace, pluginName] = file.split(path.sep);
      const plugin = path.join(namespace, pluginName);
      if (schemaFilesByPlugin.has(plugin)) {
        const existing = schemaFilesByPlugin.get(plugin);
        schemaFilesByPlugin.set(plugin, [...existing, file]);
      } else {
        schemaFilesByPlugin.set(plugin, [file]);
      }
    }
    const outputDir = path.join(process.cwd(), 'schemas');
    await fs.mkdir(outputDir, { recursive: true });

    await Promise.all(
      Array.from(schemaFilesByPlugin.entries()).map(async ([plugin, files]) => {
        const pluginOutputDir = path.join(outputDir, plugin);
        await fs.mkdir(pluginOutputDir, { recursive: true });
        await Promise.all(
          files.map(async (file) => {
            if (file.split(path.sep).includes('hooks')) {
              const hooksOutputDir = path.join(pluginOutputDir, 'hooks');
              await fs.mkdir(hooksOutputDir, { recursive: true });
              cp('-f', file, path.join(hooksOutputDir, path.basename(file)));
            } else {
              cp('-f', file, path.join(pluginOutputDir, path.basename(file)));
            }
          })
        );
      })
    );
  }
}
