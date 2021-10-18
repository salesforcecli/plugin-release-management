/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs, Messages } from '@salesforce/core';
import { cp } from 'shelljs';
import * as fg from 'fast-glob';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.schemas.collect');

export default class Test extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {};

  public async run(): Promise<void> {
    const globs = ['node_modules/@sf/**/schemas/**/*.json', 'node_modules/@salesforce/**/schemas/**/*.json'];
    const schemaFiles = (await fg(globs)).filter((f) => !f.includes(path.join('@salesforce', 'schemas')));

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
    await fs.mkdirp(outputDir);

    for (const [plugin, files] of schemaFilesByPlugin.entries()) {
      const pluginOutputDir = path.join(outputDir, plugin);
      await fs.mkdirp(pluginOutputDir);
      for (const file of files) {
        if (file.split(path.sep).includes('hooks')) {
          const hooksOutputDir = path.join(pluginOutputDir, 'hooks');
          await fs.mkdirp(hooksOutputDir);
          cp('-f', file, path.join(hooksOutputDir, path.basename(file)));
        } else {
          cp('-f', file, path.join(pluginOutputDir, path.basename(file)));
        }
      }
    }
  }
}
