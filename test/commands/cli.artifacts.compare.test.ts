/*
 * Copyright 2025, Salesforce, Inc.
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
import { expect } from 'chai';
import { SnapshotComparator, SchemaComparator } from '../../src/commands/cli/artifacts/compare.js';

const foo = {
  command: 'foo',
  plugin: '@salesforce/plugin-foo',
  flags: [],
  alias: [],
};

const bar = {
  command: 'bar',
  plugin: '@salesforce/plugin-foo',
  flags: [],
  alias: [],
};

const baz = {
  command: 'baz',
  plugin: '@salesforce/plugin-foo',
  flags: [],
  alias: [],
};

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $ref: '#/definitions/OpenResult',
  definitions: {
    OpenResult: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
};

describe('SnapshotComparator', () => {
  it('should recognize command additions', () => {
    const current = [foo, bar, baz];
    const previous = [foo, bar];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getCommandAdditions()).to.deep.equal(['baz']);
  });

  it('should recognize command removals', () => {
    const current = [foo, bar];
    const previous = [foo, bar, baz];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getCommandRemovals()).to.deep.equal(['baz']);
  });

  it('should recognize flag additions', () => {
    const current = [{ ...foo, flags: ['flag1'] }, bar, baz];
    const previous = [foo, bar, baz];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getFlagAdditions('foo')).to.deep.equal(['flag1']);
  });

  it('should recognize flag removals', () => {
    const current = [foo, bar, baz];
    const previous = [{ ...foo, flags: ['flag1'] }, bar, baz];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getFlagRemovals('foo')).to.deep.equal(['flag1']);
  });

  it('should recognize alias additions', () => {
    const current = [{ ...foo, alias: ['legacy:foo'] }, bar, baz];
    const previous = [foo, bar, baz];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getAliasAdditions('foo')).to.deep.equal(['legacy:foo']);
  });

  it('should recognize alias removals', () => {
    const current = [foo, bar, baz];
    const previous = [{ ...foo, alias: ['legacy:foo'] }, bar, baz];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getAliasRemovals('foo')).to.deep.equal(['legacy:foo']);
  });

  it('should recognize all changes', () => {
    const current = [
      // added flag, added alias, removed alias
      { ...foo, flags: ['flag1'], alias: ['beta:foo'] },
      // added flag and removed flag
      { ...bar, flags: ['flag1', 'flag2'], alias: ['legacy:bar'] },
      // added command
      { ...baz, flags: ['flag1'] },
    ];
    const previous = [
      { ...foo, flags: [], alias: ['legacy:foo'] },
      { ...bar, flags: ['flag1', 'old-flag'], alias: ['legacy:bar'] },
      // removed command
      {
        command: 'other',
        plugin: '@salesforce/plugin-foo',
        flags: [],
        alias: [],
      },
    ];
    const comparator = new SnapshotComparator(current, previous);
    expect(comparator.getChanges()).to.deep.equal({
      commandAdditions: ['baz'],
      commandRemovals: ['other'],
      hasChanges: true,
      hasBreakingChanges: true,
      commands: [
        {
          command: 'foo',
          aliasAdditions: ['beta:foo'],
          aliasRemovals: ['legacy:foo'],
          flagAdditions: ['flag1'],
          flagRemovals: [],
          hasChanges: true,
          hasBreakingChanges: true,
        },
        {
          command: 'bar',
          aliasAdditions: [],
          aliasRemovals: [],
          flagAdditions: ['flag2'],
          flagRemovals: ['old-flag'],
          hasChanges: true,
          hasBreakingChanges: true,
        },
        {
          command: 'baz',
          aliasAdditions: [],
          aliasRemovals: [],
          flagAdditions: [],
          flagRemovals: [],
          hasChanges: false,
          hasBreakingChanges: false,
        },
      ],
    });
  });
});

describe('SchemaComparator', () => {
  it('should recognize schema additions', () => {
    const updated = {
      ...schema,
      definitions: {
        ...schema.definitions,
        OpenResult: {
          ...schema.definitions.OpenResult,
          properties: {
            ...schema.definitions.OpenResult.properties,
            foo: { type: 'string' },
          },
        },
      },
    };
    const comparator = new SchemaComparator({ 'plugin-a': updated }, { 'plugin-a': schema });
    expect(comparator.getChanges()).to.deep.equal([
      {
        op: 'add',
        path: ['plugin-a', 'definitions', 'OpenResult', 'properties', 'foo'],
        value: { type: 'string' },
      },
    ]);
  });

  it('should recognize schema removals', () => {
    const old = {
      ...schema,
      definitions: {
        ...schema.definitions,
        OpenResult: {
          ...schema.definitions.OpenResult,
          properties: {
            ...schema.definitions.OpenResult.properties,
            foo: { type: 'string' },
          },
        },
      },
    };
    const comparator = new SchemaComparator({ 'plugin-a': schema }, { 'plugin-a': old });
    expect(comparator.getChanges()).to.deep.equal([
      {
        op: 'remove',
        path: ['plugin-a', 'definitions', 'OpenResult', 'properties', 'foo'],
      },
    ]);
  });

  it('should recognize schema replacements', () => {
    const updated = {
      ...schema,
      definitions: {
        ...schema.definitions,
        OpenResult: {
          ...schema.definitions.OpenResult,
          properties: {
            url: { type: 'number' },
          },
        },
      },
    };
    const comparator = new SchemaComparator({ 'plugin-a': updated }, { 'plugin-a': schema });
    expect(comparator.getChanges()).to.deep.equal([
      {
        op: 'replace',
        path: ['plugin-a', 'definitions', 'OpenResult', 'properties', 'url', 'type'],
        value: 'number',
      },
    ]);
  });
});
