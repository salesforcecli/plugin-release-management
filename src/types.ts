/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export enum CLI {
  SF = 'sf',
  SFDX = 'sfdx',
}

export enum Channel {
  LEGACY = 'legacy',
  STABLE = 'stable',
  STABLE_RC = 'stable-rc',
  LATEST = 'latest',
  LATEST_RC = 'latest-rc',
}

export type S3Manifest = {
  version: string;
  sha: string;
  baseDir: string;
  gz: string;
  xz: string;
  sha256gz: string;
  sha256xz: string;
  node: {
    compatible: string;
    recommended: string;
  };
};

export type ServiceAvailability = {
  service: string;
  name?: string;
  available: boolean;
};
