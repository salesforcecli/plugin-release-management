/*
 * Copyright 2026, Salesforce, Inc.
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
