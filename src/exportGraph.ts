/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { renderToPNG } from 'graphology-canvas/node';

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const layout = require('graphology-layout-forceatlas2');

export function graphToPng(graph, pngFilePath: string): string {
  const resolvedFilePath = path.resolve(pngFilePath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  layout.assign(graph, {
    iterations: 50,
    settings: {
      gravity: 10,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  renderToPNG(graph, resolvedFilePath, {}, () => {});
  return resolvedFilePath;
}
