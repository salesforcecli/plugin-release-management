/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { parseJsonMap } from '@salesforce/kit';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import * as fg from 'fast-glob';
import { JsonMap } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'cli.schemas.compare');

type Result = {
  correspondingFile: string | null;
  matches: boolean;
  reason?: string;
};
type Results = Record<string, Result>;

export default class Compare extends SfCommand<Results> {
  public static readonly summary = messages.getMessage('description');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {};
  public static readonly state = 'deprecated';

  public async run(): Promise<Results> {
    // The "existing schema" is the schema that is stored at the CLI level
    const existing = await getExistingSchemaFiles();
    // The "latest schema" is the schema that is found in the node_modules
    const latest = await getLatestSchemaFiles();

    // If there are more latest schema than existing schema, that means that new
    // schema was added without also being added at the CLI level.
    if (latest.length > existing.length) {
      const normalized = latest.map((c) => normalizeFilename(c));
      const missing = normalized.filter((f) => !existing.includes(f));
      throw new SfError(
        `Missing files: ${missing.join(', ')}`,
        'MissingFilesError',
        [
          'This error means that a new schema file was found in an installed plugin. Try running cli:schemas:collect first.',
        ],
        1
      );
    }

    const results: Results = Object.fromEntries(
      await Promise.all(
        existing.map(async (file): Promise<[string, Result]> => {
          const correspondingFile = latest.find((f) => normalizeFilename(f) === file);
          if (correspondingFile) {
            const [fileData, correspondingFileData] = await Promise.all([
              fs.readFile(file, 'utf8'),
              fs.readFile(correspondingFile, 'utf8'),
            ]);
            const fileContents = parseJsonMap(fileData, file);
            const correspondingFileContents = parseJsonMap(correspondingFileData, correspondingFile);
            const matches = deepEqual(fileContents, correspondingFileContents);
            return [file, { correspondingFile, matches }];
          } else {
            return [
              file,
              {
                correspondingFile: null,
                matches: false,
                reason: 'No corresponding file found in node_modules',
              },
            ];
          }
        })
      )
    );

    const data = Object.entries(results).reduce<
      Array<{ file: string; correspondingFile: string | null; matches: boolean }>
    >((x, [file, d]) => x.concat(Object.assign({ file }, d)), []);
    const columns = {
      file: { header: 'File' },
      correspondingFile: { header: 'Corresponding File' },
      matches: { header: 'Matches?' },
    };
    this.table(data, columns);

    const hasErrors = Object.values(results).some((result) => result.matches === false);
    if (hasErrors) {
      throw new SfError(
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
}

const normalizeFilename = (file: string): string => {
  const normalized = file
    .split(path.sep)
    .filter((p) => !['node_modules', 'schemas'].includes(p))
    .join(path.sep);
  return path.join('schemas', normalized);
};

const getLatestSchemaFiles = async (): Promise<string[]> => {
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
