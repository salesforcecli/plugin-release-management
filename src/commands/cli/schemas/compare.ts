/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs, Messages, SfdxError } from '@salesforce/core';
import cli from 'cli-ux';
import { SchemaUtils } from './collect';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.schemas.compare');

export type Results = {
  [key: string]: {
    correspondingFile: string;
    matches: boolean;
    reason?: string;
  };
};

export default class Compare extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {};

  public async run(): Promise<Results> {
    // The "existing schema" is the schema that is stored at the CLI level
    const existing = await SchemaUtils.getExistingSchemaFiles();
    // The "latest schema" is the schema that is found in the node_modules
    const latest = await SchemaUtils.getLatestSchemaFiles();

    // If there are more latest schema than existing schema, that means that new
    // schema was added without also being added at the CLI level.
    if (latest.length > existing.length) {
      const normalized = latest.map((c) => this.normalizeFilename(c));
      const missing = normalized.filter((f) => !existing.includes(f));
      throw new SfdxError(
        `Missing files: ${missing.join(', ')}`,
        'MissingFilesError',
        [
          'This error means that a new schema file was found in an installed plugin. Try running cli:schemas:collect first.',
        ],
        1
      );
    }

    const results: Results = {};
    for (const file of existing) {
      const correspondingFile = latest.find((f) => {
        return this.normalizeFilename(f) === file;
      });
      if (correspondingFile) {
        const fileContents = await fs.readJsonMap(file);
        const correspondingFileContents = await fs.readJsonMap(correspondingFile);
        const matches = SchemaUtils.deepEqual(fileContents, correspondingFileContents);
        results[file] = { correspondingFile, matches };
      } else {
        results[file] = {
          correspondingFile: null,
          matches: false,
          reason: 'No corresponding file found in node_modules',
        };
      }
    }

    if (!this.flags.json) {
      const data = Object.entries(results).reduce((x, [file, d]) => {
        return x.concat(Object.assign({ file }, d));
      }, [] as Array<{ file: string; correspondingFile: string; matches: boolean }>);
      const columns = {
        file: { header: 'File' },
        correspondingFile: { header: 'Corresponding File' },
        matches: { header: 'Matches?' },
      };
      cli.table(data, columns);
    }

    const hasErrors = Object.values(results).some((result) => result.matches === false);
    if (hasErrors) {
      throw new SfdxError(
        'Found schema changes',
        'SchemaMismatchError',
        [
          'This error means that the schema in an installed plugin have changed. If this is intentional, try running cli:schemas:collect first.',
        ],
        1
      );
    }
    return results;
  }

  private normalizeFilename(file: string): string {
    const normalized = file
      .split(path.sep)
      .filter((p) => !['node_modules', 'schemas'].includes(p))
      .join(path.sep);
    return path.join('schemas', normalized);
  }
}
