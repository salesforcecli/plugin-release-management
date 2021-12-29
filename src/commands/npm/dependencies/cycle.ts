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
    pngfilepath: flags.filepath({ char: 'f', description: messages.getMessage('flags.pnhFilePath') }),
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

  public async run(): Promise<GraphCycles> {
    const modules = this.flags.modules as string[];
    const dependencyTypes: DependencyTypes[] = this.flags.types as DependencyTypes[];
    this.ux.log(
      `Looking for dependency cycles across modules "${modules.join(
        ', '
      )}" within dependency types "${dependencyTypes.join(', ')}"`
    );
    this.ux.startSpinner('Processing modules');
    const packages = await Promise.all(
      modules.map(async (module) => {
        // make package for requested module
        const modulePackage = await this.makePackageFromModule(module);
        // for each dep, create module name that contains exact version
        const depModuleNames = dependencyTypes
          .map((type: string) => {
            return Object.entries(this.getDeps(modulePackage, type)).map(([name, version]) => {
              const moduleName = version.startsWith('npm:')
                ? parseAliasedPackageNameAndVersion(version)
                : `${name}@${version}`;
              return exactVersion(moduleName);
            });
          })
          .flat();
        const depsPackages = await Promise.all(
          depModuleNames.map(async (depModuleName) => {
            return this.makePackageFromModule(depModuleName);
          })
        );
        return [modulePackage, ...depsPackages] as NpmPackage[];
      })
    );
    this.ux.setSpinnerStatus('Building graph');
    packages.flat().forEach((pkg) => {
      this.addNode(pkg.name, { x: Math.random(), y: Math.random(), size: nodeSize, label: pkg.name });
      return dependencyTypes.map((type: string) => {
        const deps = this.getDeps(pkg, type);
        Object.entries(deps).forEach(([name, version]) => {
          const normalName = version.startsWith('npm:') ? parseAliasedPackageName(version) : name;
          this.addNode(normalName, { x: Math.random(), y: Math.random(), size: nodeSize, label: normalName });
          this.graph.addEdgeWithKey(`${pkg.name}->${normalName}`, pkg.name, normalName);
        });
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

  private addNode(name: string, attributes?: Record<string, unknown>): string {
    return this.graph.hasNode(name) ? name : this.graph.addNode(name, attributes);
  }

  private async makePackageFromModule(module: string): Promise<NpmPackage> {
    let pkg: Package;
    if (module === '.') {
      pkg = await Package.create();
      const pjson: PackageJson = await pkg.readPackageJson();
      return Object.assign(pkg.npmPackage, pjson) as NpmPackage;
    } else if (this.isFilePath(module)) {
      pkg = await Package.create(path.resolve(module));
      const pjson = await pkg.readPackageJson();
      return Object.assign(pkg.npmPackage, pjson) as NpmPackage;
    } else {
      const npmName = NpmName.parse(module);
      pkg = new Package(npmName.toString());
      return pkg.retrieveNpmPackage(npmName.toString(), npmName.tag, [
        'version',
        'name',
        'dist-tags',
        ...(this.flags.types as string[]),
      ]);
    }
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

  private getDeps(pkg: NpmPackage, type: string): Record<string, string> {
    switch (type) {
      case DependencyTypes.devDependencies:
        return pkg.devDependencies || {};
      case DependencyTypes.dependencies:
        return pkg.dependencies || {};
      case DependencyTypes.peerDependencies:
        return pkg.peerDependencies || {};
    }
  }

  private saveToPng(graph: Graph): void {
    if (this.flags.pngfilepath) {
      this.ux.setSpinnerStatus(`Save graph to file ${graphToPng(graph, this.flags.pngfilepath)}`);
    }
  }
}
