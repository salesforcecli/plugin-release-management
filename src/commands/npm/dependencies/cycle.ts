/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'fs';
import { flags, FlagsConfig, Result, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import Graph, { MultiDirectedGraph } from 'graphology';

import {
  NpmPackage,
  Package,
  PackageJson,
  parseAliasedPackageName,
  exactVersion,
  parseAliasedPackageNameAndVersion,
} from '../../../package';
import { NpmName } from '../../../codeSigning/NpmName';
import { findCyclesInDependencyGraph, Cycles as GraphCycles } from '../../../dependencies';
import { graphToPng } from '../../../exportGraph';

const nodeSize = 15;
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-release-management', 'npm.dependencies.cycle');

enum DependencyTypes {
  'dependencies' = 'dependencies',
  'devDependencies' = 'devDependencies',
  'peerDependencies' = 'peerDependencies',
}

export default class Cycles extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly flagsConfig: FlagsConfig = {
    modules: flags.array({
      char: 'm',
      description: messages.getMessage('flags.modules'),
      default: ['.'],
    }),
    depth: flags.number({
      description: messages.getMessage('flags.types'),
      default: 2,
      min: 1,
    }),
    types: flags.array({
      char: 't',
      description: messages.getMessage('flags.types'),
      options: [DependencyTypes.dependencies, DependencyTypes.devDependencies, DependencyTypes.peerDependencies],
      default: [DependencyTypes.dependencies],
    }),
    erroroncycles: flags.boolean({
      char: 'e',
      description: messages.getMessage('flags.errorOnCycles'),
      default: true,
      allowNo: true,
    }),
    pngfilepath: flags.filepath({
      char: 'f',
      description: messages.getMessage('flags.pnhFilePath'),
    }),
  };
  protected static result = {
    display(): void {
      // eslint-disable-next-line @typescript-eslint/no-this-alias,@typescript-eslint/no-unsafe-assignment
      const r: Result = this;
      const cycles = r.data as GraphCycles;
      if (cycles.length === 0) {
        r.ux.log('No cycles found');
      } else {
        r.ux.table(
          cycles.map((c) => {
            return { nodeA: c.between.nodeA, nodeB: c.between.nodeB, path: c.cycleAsPath.join('->') };
          }),
          ['nodeA', 'nodeB', 'path']
        );
      }
    },
  };
  private graph: Graph = new MultiDirectedGraph();
  private packagesVisited = new Map<string, NpmPackage>();

  public async run(): Promise<GraphCycles> {
    const modules = this.flags.modules as string[];
    const dependencyTypes: DependencyTypes[] = this.flags.types as DependencyTypes[];
    this.ux.log(
      `Looking for dependency cycles across modules "${modules.join(
        ', '
      )}" within dependency types "${dependencyTypes.join(', ')} to a depth of ${this.flags.depth as number}"`
    );
    this.ux.startSpinner('Processing modules');
    const packages = await this.createPackagesFromModules(modules, dependencyTypes, this.flags.depth);
    this.ux.setSpinnerStatus('Building graph');
    packages.forEach((pkg) => {
      this.addNode(pkg.name, { x: Math.random(), y: Math.random(), size: nodeSize, label: pkg.name });
      Object.entries(this.getDeps(pkg, dependencyTypes)).forEach(([name, version]) => {
        const normalName = version.startsWith('npm:') ? parseAliasedPackageName(version) : name;
        this.addNode(normalName, { x: Math.random(), y: Math.random(), size: nodeSize, label: normalName });
        try {
          this.graph.addEdgeWithKey(`${pkg.name}->${normalName}`, pkg.name, normalName);
        } catch {
          // eat the error
        }
      });
    });
    this.ux.setSpinnerStatus('Finding dependency cycles');
    const cycles = findCyclesInDependencyGraph(this.graph);
    this.saveToPng(this.graph);
    this.ux.stopSpinner();
    if (this.flags.erroroncycles && cycles.length > 0) {
      process.exitCode = 1;
    }
    return cycles;
  }

  private async createPackagesFromModules(
    modules: string[],
    dependencyTypes: DependencyTypes[],
    depth: number
  ): Promise<NpmPackage[]> {
    if (depth <= 0) return [];
    return (
      await Promise.all(
        modules.map(async (module) => {
          this.ux.setSpinnerStatus(module);
          // make package for requested module
          const modulePackage = await this.makePackageFromModule(module);
          // for each dep, create module name that contains exact version
          const depModuleNames = Object.entries(this.getDeps(modulePackage, dependencyTypes)).map(([name, version]) => {
            const moduleName = version.startsWith('npm:')
              ? parseAliasedPackageNameAndVersion(version)
              : `${name}@${version}`;
            return exactVersion(moduleName);
          });
          return [
            modulePackage,
            ...(await this.createPackagesFromModules(depModuleNames, dependencyTypes, depth - 1)),
          ] as NpmPackage[];
        })
      )
    ).flat(20);
  }

  private addNode(name: string, attributes?: Record<string, unknown>): string {
    return this.graph.hasNode(name) ? name : this.graph.addNode(name, attributes);
  }

  private async makePackageFromModule(module: string): Promise<NpmPackage> {
    let pkg: Package;
    let npmPackage: NpmPackage;
    if (module === '.') {
      pkg = await Package.create();
      const pjson: PackageJson = await pkg.readPackageJson();
      npmPackage = Object.assign(pkg.npmPackage, pjson) as NpmPackage;
    } else if (this.isFilePath(module)) {
      pkg = await Package.create(path.resolve(module));
      const pjson = await pkg.readPackageJson();
      npmPackage = Object.assign(pkg.npmPackage, pjson) as NpmPackage;
    } else {
      const npmName = NpmName.parse(module);
      if (this.packagesVisited.has(npmName.toString())) return this.packagesVisited.get(npmName.toString());
      pkg = new Package(npmName.toString());
      npmPackage = await pkg.retrieveNpmPackageAsync(npmName.toString(), npmName.tag, [
        'version',
        'name',
        'dist-tags',
        ...(this.flags.types as string[]),
      ]);
    }
    this.packagesVisited.set(npmPackage.name, npmPackage);
    return npmPackage;
  }

  private isFilePath(module: string): boolean {
    try {
      fs.statSync(path.resolve(module));
      return true;
    } catch (error) {
      // eat it
    }
    return false;
  }

  private getDeps(pkg: NpmPackage, types: string[]): Record<string, string> {
    return types
      .map((type) => {
        switch (type) {
          case DependencyTypes.devDependencies:
            return pkg.devDependencies || {};
          case DependencyTypes.dependencies:
            return pkg.dependencies || {};
          case DependencyTypes.peerDependencies:
            return pkg.peerDependencies || {};
        }
      })
      .reduce((a, b) => {
        return Object.assign(a, b);
      }, {} as Record<string, string>);
  }

  private saveToPng(graph: Graph): void {
    if (this.flags.pngfilepath) {
      this.ux.setSpinnerStatus(`Save graph to file ${graphToPng(graph, this.flags.pngfilepath)}`);
    }
  }
}
