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

export type VersionShaContents = {
  Key: string;
  LastModified: string;
  LastModifiedDate: Date;
  ETag: string;
  Size: number;
  StorgaeClass: string;
};
