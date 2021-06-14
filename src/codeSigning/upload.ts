/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as AWS from 'aws-sdk';

export async function putObject(bucket: string, key: string, body: string): Promise<AWS.S3.PutObjectOutput> {
  return new Promise((resolve, reject) => {
    const s3 = new AWS.S3();
    s3.putObject({ Bucket: bucket, Key: key, Body: body }, (err, resp) => {
      if (err) reject(err);
      if (resp) resolve(resp);
    });
  });
}
