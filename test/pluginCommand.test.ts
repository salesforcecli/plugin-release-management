/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';
import { PluginCommand } from '../src/pluginCommand';

describe('pluginCommand', () => {
  it('should run oclif command "promote --help', async () => {
    const oclifCommand = await PluginCommand.create({
      commandBin: 'oclif',
      cliRoot: path.resolve(path.join(__dirname, '..')),
      npmName: 'oclif',
    });
    const result = oclifCommand.runPluginCmd({ command: 'promote', parameters: ['--help'] });
    expect(result).to.be.ok;
  });
  it('should fail to find npm package', async () => {
    try {
      await PluginCommand.create({
        commandBin: 'oclif',
        cliRoot: path.resolve(path.join(__dirname, '..')),
        npmName: 'doesnotexist',
      });
      expect.fail('should have thrown exception');
    } catch (error) {
      expect(error.message).to.match(/Cannot find module.*?doesnotexist/);
    }
  });
  it('should fail to find bin in package', async () => {
    try {
      await PluginCommand.create({
        commandBin: 'oclifxxx',
        cliRoot: path.resolve(path.join(__dirname, '..')),
        npmName: 'oclif',
      });
      expect.fail('should have thrown exception');
    } catch (error) {
      expect(error.message).to.match(/Could not locate commandBin oclifxxx/);
    }
  });
  it('should fail command oclif foobarbaz', async () => {
    try {
      const oclifCommand = await PluginCommand.create({
        commandBin: 'oclif',
        cliRoot: path.resolve(path.join(__dirname, '..')),
        npmName: 'oclif',
      });
      oclifCommand.runPluginCmd({ command: 'foobarbaz', parameters: ['--help'] });
      expect.fail('should have thrown exception');
    } catch (error) {
      expect(error.message).to.match(/Command foobarbaz not found/);
    }
  });
  it('should fail command oclif promote with invalid params', async () => {
    try {
      const oclifCommand = await PluginCommand.create({
        commandBin: 'oclif',
        cliRoot: path.resolve(path.join(__dirname, '..')),
        npmName: 'oclif',
      });
      oclifCommand.runPluginCmd({ command: 'promote', parameters: ['--targets foobarbaz'] });
      expect.fail('should have thrown exception');
    } catch (error) {
      expect(error.message).to.match(/Unexpected argument: --targets foobarbaz/);
    }
  });
});
