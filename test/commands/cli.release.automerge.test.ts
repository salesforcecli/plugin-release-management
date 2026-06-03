/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ALLOWED_BOT_USERS, isAllowedBotUser } from '../../src/commands/cli/release/automerge.js';

describe('cli:release:automerge bot allow-list', () => {
  it('accepts svc-cli-bot', () => {
    expect(isAllowedBotUser('svc-cli-bot')).to.equal(true);
  });

  it('accepts svc-idee-bot', () => {
    expect(isAllowedBotUser('svc-idee-bot')).to.equal(true);
  });

  it('rejects an unknown user', () => {
    expect(isAllowedBotUser('random-user')).to.equal(false);
  });

  it('rejects undefined login', () => {
    expect(isAllowedBotUser(undefined)).to.equal(false);
  });

  it('rejects null login', () => {
    expect(isAllowedBotUser(null)).to.equal(false);
  });

  it('rejects empty string login', () => {
    expect(isAllowedBotUser('')).to.equal(false);
  });

  it('exports the canonical allow-list', () => {
    expect(ALLOWED_BOT_USERS).to.deep.equal(['svc-cli-bot', 'svc-idee-bot']);
  });
});
