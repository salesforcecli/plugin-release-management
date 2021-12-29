/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { Env } from '@salesforce/kit';
import { DirectedGraph } from 'graphology';
import { findCyclesInDependencyGraph, verifyDependencies } from '../src/dependencies';

const $$ = testSetup();

describe('Dependencies', () => {
  it('should pass when all required env variables exist', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns('foobar');
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(0);
    expect(validation.results).to.deep.equal([
      { name: 'AWS_ACCESS_KEY_ID', type: 'env', passed: true },
      { name: 'AWS_SECRET_ACCESS_KEY', type: 'env', passed: true },
      { name: 'NPM_TOKEN', type: 'env', passed: true },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });

  it('should pass when required env variables are NOT set', () => {
    $$.SANDBOX.stub(Env.prototype, 'getString').returns(null);
    const validation = verifyDependencies({ sign: true });
    expect(validation.failures).to.equal(3);
    expect(validation.results).to.deep.equal([
      {
        name: 'AWS_ACCESS_KEY_ID',
        type: 'env',
        passed: false,
        message: 'Set AWS_ACCESS_KEY_ID environment variable',
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        type: 'env',
        passed: false,
        message: 'Set AWS_SECRET_ACCESS_KEY environment variable',
      },
      {
        name: 'NPM_TOKEN',
        type: 'env',
        passed: false,
        message: 'Set NPM_TOKEN environment variable',
      },
      { name: 'GH_TOKEN', type: 'env', passed: true },
    ]);
  });
});

describe('dependency graph cycle tests', () => {
  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log('=');
  });
  it('should have no cycles - simplest tree a->b a-c', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b');
    graph.addEdge('a', 'c');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(0);
  });
  it('should have no cycles - simple', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'd');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(0);
  });
  it('should have no cycles - diamond', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b');
    graph.addEdge('a', 'c');
    graph.addEdge('c', 'd');
    graph.addEdge('b', 'd');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(0);
  });
  it('should have cycles - a->b->c', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'a');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(1);
    expect(cycles[0].between).deep.equal({ nodeA: 'c', nodeB: 'a' });
  });
  it('should have cycles - a->b->c->a and a->b->c->d->c', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('d', 'c');
    graph.addEdge('c', 'a');
    graph.addEdge('c', 'd');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(2);
    expect(cycles[0].between).deep.equal({ nodeA: 'c', nodeB: 'a' });
    expect(cycles[1].between).deep.equal({ nodeA: 'd', nodeB: 'c' });
  });
  it('should have cycles - a->b->c->a and 1->2->1', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('1');
    graph.addNode('2');
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'a');
    graph.addEdge('1', '2');
    graph.addEdge('2', '1');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(2);
    expect(cycles[0].between).deep.equal({ nodeA: 'c', nodeB: 'a' });
    expect(cycles[1].between).deep.equal({ nodeA: '2', nodeB: '1' });
  });
  it('should have cycles - from all levels', () => {
    const graph = new DirectedGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addNode('d');
    graph.addNode('e');
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'a');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'd');
    graph.addEdge('c', 'b');
    graph.addEdge('d', 'e');
    graph.addEdge('d', 'c');
    graph.addEdge('d', 'a');
    graph.addEdge('d', 'b');
    const cycles = findCyclesInDependencyGraph(graph);
    expect(cycles).to.have.lengthOf(5);
    expect(cycles[0].between).deep.equal({ nodeA: 'b', nodeB: 'a' });
    expect(cycles[1].between).deep.equal({ nodeA: 'c', nodeB: 'b' });
    expect(cycles[2].between).deep.equal({ nodeA: 'd', nodeB: 'a' });
    expect(cycles[3].between).deep.equal({ nodeA: 'd', nodeB: 'b' });
    expect(cycles[4].between).deep.equal({ nodeA: 'd', nodeB: 'c' });
  });
});
