/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NamedError } from '@salesforce/kit';

export class ExecProcessFailed extends NamedError {
  public constructor(process: string, errorCode: string, message: string) {
    super(
      'Sub-process failed.',
      `Exec'd subprocess ${process} failed with error code '${errorCode}' and message '${message}'.`
    );
  }
}
