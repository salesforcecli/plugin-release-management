/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { Readable } from 'stream';
import { exec } from 'shelljs';
import * as conventionalCommitsParser from 'conventional-commits-parser';
import * as conventionalChangelogPresetLoader from 'conventional-changelog-preset-loader';
import { Nullable } from '@salesforce/ts-types';
import { Package } from './package';

export interface Commit {
  type: Nullable<string>;
  header: Nullable<string>;
  body: Nullable<string>;
}

export interface CommitInspection {
  releasableCommits: Commit[];
  unreleasableCommits: Commit[];
  nextVersionIsHardcoded: boolean;
  shouldRelease: boolean;
  isMajorBump?: boolean;
}

/**
 * If the commit type isn't fix (patch bump), feat (minor bump), or breaking (major bump),
 * then standard-version always defaults to a patch bump.
 * See https://github.com/conventional-changelog/standard-version/issues/577
 *
 * We, however, don't want to publish a new version for chore, docs, etc. So we analyze
 * the commits to see if any of them indicate that a new release should be published.
 */
export async function inspectCommits(pkg: Package, lerna = false): Promise<CommitInspection> {
  const skippableCommitTypes = ['chore', 'style', 'docs', 'ci', 'test'];

  // find the latest git tag so that we can get all the commits that have happened since
  const tags = exec('git fetch --tags && git tag', { silent: true }).stdout.split(os.EOL);
  const latestTag = lerna
    ? tags.find((tag) => tag.includes(`${pkg.name}@${pkg.npmPackage.version}`)) || ''
    : tags.find((tag) => tag.includes(pkg.npmPackage.version));
  // import the default commit parser configuration
  const defaultConfigPath = require.resolve('conventional-changelog-conventionalcommits');
  const configuration = await conventionalChangelogPresetLoader({ name: defaultConfigPath });

  const commits: Commit[] = await new Promise((resolve) => {
    const DELIMITER = 'SPLIT';
    const gitLogCommand = lerna
      ? `git log --format=%B%n-hash-%n%H%n${DELIMITER} ${latestTag}..HEAD --no-merges -- ${pkg.location}`
      : `git log --format=%B%n-hash-%n%H%n${DELIMITER} ${latestTag}..HEAD --no-merges`;
    const gitLog = exec(gitLogCommand, { silent: true })
      .stdout.split(`${DELIMITER}${os.EOL}`)
      .filter((c) => !!c);
    const readable = Readable.from(gitLog);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore because the type exported from conventionalCommitsParser is wrong
    const parser = readable.pipe(conventionalCommitsParser(configuration.parserOpts));
    const allCommits: Commit[] = [];
    parser.on('data', (commit: Commit) => allCommits.push(commit));
    parser.on('finish', () => resolve(allCommits));
  });

  const nextVersionIsHardcoded = pkg.nextVersionIsHardcoded();
  // All commits are releasable if the version hardcoded in the package.json
  // In this scenario, we want to publish regardless of the commit types
  if (nextVersionIsHardcoded) {
    return {
      releasableCommits: commits,
      unreleasableCommits: [],
      nextVersionIsHardcoded,
      shouldRelease: true,
    };
  }

  const releasableCommits: Commit[] = [];
  const unreleasableCommits: Commit[] = [];
  let majorBumpRequired = false;
  for (const commit of commits) {
    const headerIndicatesMajorChange = !!commit.header && commit.header.includes('!');
    const bodyIndicatesMajorChange = !!commit.body && commit.body.includes('BREAKING');
    const typeIsSkippable = skippableCommitTypes.includes(commit.type);
    const isBreakingChange = bodyIndicatesMajorChange || headerIndicatesMajorChange;
    const isReleasable = !typeIsSkippable || isBreakingChange;
    if (isReleasable) {
      releasableCommits.push(commit);
    } else {
      unreleasableCommits.push(commit);
    }

    if (isBreakingChange) majorBumpRequired = true;
  }

  return {
    releasableCommits,
    unreleasableCommits,
    nextVersionIsHardcoded,
    isMajorBump: majorBumpRequired,
    shouldRelease: nextVersionIsHardcoded || releasableCommits.length > 0,
  };
}
