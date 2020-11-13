/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NamedError } from '@salesforce/kit';

export class InvalidUrlError extends NamedError {
  public constructor(url: string, cause: Error) {
    super('InvalidUrl', `The following url is not valid ${url}`, cause);
  }
}

export class MissingRequiredParameter extends NamedError {
  public constructor(parameterName: string) {
    super('MissingRequiredParameter', `The parameter ${parameterName} is missing but required.`);
  }
}

export class ExecProcessFailed extends NamedError {
  public constructor(process: string, errorCode: string, message: string) {
    super(
      'Sub-process failed.',
      `Exec'd subprocess ${process} failed with error code '${errorCode}' and message '${message}'.`
    );
  }
}

export class UnexpectedHost extends NamedError {
  public constructor(url: string) {
    super('UnexpectedHost', `The host is not allowed to provide signing information. [${url}]`);
  }
}

export class UnauthorizedSslConnection extends NamedError {
  public constructor(url: string) {
    const message = `An attempt is being made to retrieve content from an unauthorized ssl url [${url}].
This endpoint could be using a self signed certificate.
To allow this set the following environment variable: NODE_TLS_REJECT_UNAUTHORIZED=0`;
    super('UnauthorizedSslConnection', message);
  }
}

export class SignSignedCertError extends NamedError {
  public constructor() {
    super(
      'SelfSignedCert',
      'Encountered a self signed certificated. To enable "export NODE_TLS_REJECT_UNAUTHORIZED=0"'
    );
  }
}
