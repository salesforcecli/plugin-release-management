# plugin-release-management

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-release-management.svg?label=@salesforce/plugin-release-management)](https://www.npmjs.com/package/@salesforce/plugin-release-management) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-release-management.svg)](https://npmjs.org/package/@salesforce/plugin-release-management) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-release-management/main/LICENSE.txt)

Plugin designed to handle all tasks related to signing, releasing, and testing npm packages.

## Releases

The following steps are automated for package releases

### Version Bump

We use [standard-version](https://github.com/conventional-changelog/standard-version) to determine the next version that will be published. This means that all commits **must** adhere to the [conventional commits specification](https://www.conventionalcommits.org/en/v1.0.0/) in order for `standard-version` to work.

In the case that you have manually bumped the version in the package.json, then the plugin will respect that and publish that version instead of using `standard-version` to determine the next version.

NOTE: We consider the `chore`, `style`, `docs`, `ci`, `test` commit types to be "non-releasable", meaning that if all the commits are of those types then we do not publish a new version. However, if you've manually bumped the version in the package.json then the plugin will publish that version regardless of the commit types.

#### `--prerelease`

1. If you've manually bumped the version in the package.json, the prerelease tag will not be added if it's not already there. For example, if you want to do a prerelease for a new major version, you will want to update the package version to `X.0.0-<your-prerelease-tag>`.

2. When using the `--prerelease` flag, `standard-version` will bump both the prerelease version and the package version, e.g. `3.0.0-alpha.0` => `3.0.1-alpha.1`. See https://github.com/conventional-changelog/standard-version#release-as-a-pre-release for more

### Changelogs

`standard-version` automatically handles this for us as well. Again you must adhere to the [conventional commits specification](https://www.conventionalcommits.org/en/v1.0.0/) in order for the changelog generation to work.

### Build

After determining the next version, the plugin builds the package using `yarn build`. This means that you must have a `build` script included in the package.json

### Signing

If you pass the `--sign (-s)` flag into the release command, then the plugin will sign the package and verify that the signature exists in S3.

### Publishing

Once the package has been built and signed it will be published to npm. The command will not exit until the new version is found on the npm registry.

## Install

```bash
sfdx plugins:install release-management@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-release-management

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev npm
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sfdx cli
sfdx plugins:link .
# To verify
sfdx plugins
```

# Commands

<!-- commands -->

- [`sfdx channel promote`](#sfdx-channel-promote)
- [`sfdx cli artifacts compare`](#sfdx-cli-artifacts-compare)
- [`sfdx cli install jit test`](#sfdx-cli-install-jit-test)
- [`sfdx cli install test`](#sfdx-cli-install-test)
- [`sfdx cli release automerge`](#sfdx-cli-release-automerge)
- [`sfdx cli release build`](#sfdx-cli-release-build)
- [`sfdx cli releasenotes`](#sfdx-cli-releasenotes)
- [`sfdx cli tarballs prepare`](#sfdx-cli-tarballs-prepare)
- [`sfdx cli tarballs smoke`](#sfdx-cli-tarballs-smoke)
- [`sfdx cli tarballs verify`](#sfdx-cli-tarballs-verify)
- [`sfdx cli versions inspect`](#sfdx-cli-versions-inspect)
- [`sfdx dependabot automerge`](#sfdx-dependabot-automerge)
- [`sfdx github check closed`](#sfdx-github-check-closed)
- [`sfdx npm dependencies pin`](#sfdx-npm-dependencies-pin)
- [`sfdx npm package release`](#sfdx-npm-package-release)
- [`sfdx plugins trust verify`](#sfdx-plugins-trust-verify)
- [`sfdx repositories`](#sfdx-repositories)

## `sfdx channel promote`

promote a s3 channel

```
USAGE
  $ sfdx channel promote -t <value> -c sf|sfdx [--json] [-d] [-C <value>] [-p win|macos|deb] [-s <value>] [-m
    <value>] [-i] [-x] [-T linux-x64|linux-arm|win32-x64|win32-x86|darwin-x64] [-v <value>]

FLAGS
  -C, --promote-from-channel=<value>     the channel name that you want to promote
  -T, --architecture-target=<option>...  comma-separated targets to promote (e.g.: linux-arm,win32-x64)
                                         <options: linux-x64|linux-arm|win32-x64|win32-x86|darwin-x64>
  -c, --cli=<option>                     (required) the cli name to promote
                                         <options: sf|sfdx>
  -d, --dryrun                           If true, only show what would happen
  -i, --[no-]indexes                     append the promoted urls into the index files
  -m, --max-age=<value>                  [default: 300] cache control max-age in seconds
  -p, --platform=<option>...             the platform to promote
                                         <options: win|macos|deb>
  -s, --sha=<value>                      the short sha to promote
  -t, --promote-to-channel=<value>       (required) [default: stable] the channel name that you are promoting to
  -v, --version=<value>                  the version of the candidate to be promoted, which must exist already in s3.
                                         Used to fetch the correct sha
  -x, --[no-]xz                          also upload xz

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  promote a s3 channel

  promote a s3 channel

EXAMPLES
  $ sfdx channel promote --candidate latest-rc --target latest --platform win --platform mac
```

_See code: [src/commands/channel/promote.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/channel/promote.ts)_

## `sfdx cli artifacts compare`

Look for breaking changes in artifacts (schemas and snapshots) from plugins. Must be run in CLI directory.

```
USAGE
  $ sfdx cli artifacts compare [--json] [-p <value>] [-r <value>] [-c <value>]

FLAGS
  -c, --current=<value>    Current CLI version to compare against. Defaults to the version on the CLI in the current
                           directory.
  -p, --plugin=<value>...  List of plugins to check for breaking changes.
  -r, --previous=<value>   Previous CLI version to compare against. Defaults to the last published version.

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  $ sfdx cli artifacts compare
```

_See code: [src/commands/cli/artifacts/compare.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/artifacts/compare.ts)_

## `sfdx cli install jit test`

Test that all JIT plugins can be successfully installed.

```
USAGE
  $ sfdx cli install jit test [--json] [-j <value>]

FLAGS
  -j, --jit-plugin=<value>...  JIT plugin(s) to test, example: @salesforce/plugin-community

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  $ sfdx cli install jit test
```

_See code: [src/commands/cli/install/jit/test.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/install/jit/test.ts)_

## `sfdx cli install test`

install sf or sfdx

```
USAGE
  $ sfdx cli install test -c sf|sfdx -m installer|npm|tarball [--json] [--channel
    legacy|stable|stable-rc|latest|latest-rc] [--output-file <value>]

FLAGS
  -c, --cli=<option>         (required) the cli to install
                             <options: sf|sfdx>
  -m, --method=<option>      (required) the installation method to use
                             <options: installer|npm|tarball>
      --channel=<option>     [default: stable] the channel to install from
                             <options: legacy|stable|stable-rc|latest|latest-rc>
      --output-file=<value>  [default: test-results.json] the file to write the JSON results to (must be .json)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  install sf or sfdx

  install sf or sfdx

EXAMPLES
  $ sfdx cli install test --cli sfdx --method installer

  $ sfdx cli install test --cli sfdx --method npm

  $ sfdx cli install test --cli sfdx --method tarball

  $ sfdx cli install test --cli sf --method tarball

  $ sfdx cli install test --cli sf --method tarball --channel stable-rc
```

_See code: [src/commands/cli/install/test.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/install/test.ts)_

## `sfdx cli release automerge`

Attempt to automerge nightly PR

```
USAGE
  $ sfdx cli release automerge (--owner <value> --repo <value>) --pull-number <value> [--json] [-d] [--verbose]

FLAGS
  -d, --dry-run              Run all checks, but do not merge PR
      --owner=<value>        (required) Github owner (org), example: salesforcecli
      --pull-number=<value>  (required) Github pull request number to merge
      --repo=<value>         (required) Github repo, example: sfdx-cli
      --verbose              Show additional debug output

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Attempt to automerge nightly PR

  Attempt to automerge nightly PR

EXAMPLES
  $ sfdx cli release automerge --owner salesforcecli --repo sfdx-cli --pul-number 1049
```

_See code: [src/commands/cli/release/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/release/automerge.ts)_

## `sfdx cli release build`

builds a new release from a designated starting point and optionally creates PR in Github

```
USAGE
  $ sfdx cli release build -c <value> [--json] [-d <value>] [-g <value>] [--build-only] [--resolutions] [--only
    <value>] [--pinned-deps] [--jit] [--label <value>] [--patch] [--empty] [--pr-base-branch <value>]

FLAGS
  -c, --release-channel=<value>          (required) the channel intended for this release, examples: nightly, latest-rc,
                                         latest, dev, beta, etc...
  -d, --start-from-npm-dist-tag=<value>  the npm dist-tag to start the release from, examples: nightly, latest-rc
  -g, --start-from-github-ref=<value>    a Github ref to start the release from, examples: main, 7.144.0, f476e8e
      --build-only                       only build the release, do not git add/commit/push
      --empty                            create an empty release PR for pushing changes to later (version will still be
                                         bumped)
      --[no-]jit                         bump the versions of the packages listed in the jitPlugins (just-in-time)
                                         section
      --label=<value>...                 add one or more labels to the Github PR
      --only=<value>...                  only bump the version of the packages passed in, uses latest if version is not
                                         provided
      --patch                            bump the release as a patch of an existing version, not a new minor version
      --[no-]pinned-deps                 bump the versions of the packages listed in the pinnedDependencies section
      --pr-base-branch=<value>           base branch to create the PR against; if not specified, the build determines
                                         the branch for you
      --[no-]resolutions                 bump the versions of packages listed in the resolutions section

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  builds a new release from a designated starting point and optionally creates PR in Github

  builds a new release from a designated starting point and optionally creates PR in Github

ALIASES
  $ sfdx cli latestrc build

EXAMPLES
  $ sfdx cli release build

  $ sfdx cli release build --patch

  $ sfdx cli release build --start-from-npm-dist-tag latest-rc --patch

  $ sfdx cli release build --start-from-github-ref 7.144.0

  $ sfdx cli release build --start-from-github-ref main

  $ sfdx cli release build --start-from-github-ref f476e8e

  $ sfdx cli release build --start-from-github-ref main --prerelease beta

  $ sfdx cli release build --build-only

  $ sfdx cli release build --only @salesforce/plugin-source,@salesforce/plugin-info@1.2.3
```

_See code: [src/commands/cli/release/build.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/release/build.ts)_

## `sfdx cli releasenotes`

pull all relevant information for writing release notes.

```
USAGE
  $ sfdx cli releasenotes -c sf|sfdx [--json] [-s <value>] [-m]

FLAGS
  -c, --cli=<option>   (required) the cli to pull information for
                       <options: sf|sfdx>
  -m, --markdown       format the output in markdown
  -s, --since=<value>  the version number of the previous release. Defaults to the latest-rc version on npm

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  pull all relevant information for writing release notes.
  Requires the GH_TOKEN to be set in the environment.

  pull all relevant information for writing release notes.
  Requires the GH_TOKEN to be set in the environment.

EXAMPLES
  $ sfdx cli releasenotes --cli sf

  $ sfdx cli releasenotes --cli sfdx

  $ sfdx cli releasenotes --cli sf --since 1.0.0

  $ sfdx cli releasenotes --cli sfdx --since 7.19.0

  $ sfdx cli releasenotes --cli sf > changes.txt

  $ sfdx cli releasenotes --cli sf --markdown > changes.md
```

_See code: [src/commands/cli/releasenotes.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/releasenotes.ts)_

## `sfdx cli tarballs prepare`

remove unnecessary files from node_modules

```
USAGE
  $ sfdx cli tarballs prepare [--json] [-d] [-t] [--verbose]

FLAGS
  -d, --dryrun   only show what would be removed from node_modules
  -t, --types    remove all types (.d.ts) files from node_modules
      --verbose  show all files paths being removed

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  remove unnecessary files from node_modules

  remove unnecessary files from node_modules

EXAMPLES
  $ sfdx cli tarballs prepare
```

_See code: [src/commands/cli/tarballs/prepare.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/tarballs/prepare.ts)_

## `sfdx cli tarballs smoke`

smoke tests for the sf CLI

```
USAGE
  $ sfdx cli tarballs smoke [--json] [--verbose]

FLAGS
  --verbose  show the --help output for each command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  smoke tests for the sf CLI
  Tests that the CLI and every command can be initialized.

  smoke tests for the sf CLI
  Tests that the CLI and every command can be initialized.

EXAMPLES
  $ sfdx cli tarballs smoke

  $ sfdx cli tarballs smoke
```

_See code: [src/commands/cli/tarballs/smoke.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/tarballs/smoke.ts)_

## `sfdx cli tarballs verify`

verify that tarballs are ready to be uploaded

```
USAGE
  $ sfdx cli tarballs verify [--json] [-c sf|sfdx] [-w <value>]

FLAGS
  -c, --cli=<option>                     [default: sfdx] the cli to verify
                                         <options: sf|sfdx>
  -w, --windows-username-buffer=<value>  [default: 41] the number of characters to allow for windows usernames

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  verify that tarballs are ready to be uploaded

  verify that tarballs are ready to be uploaded

EXAMPLES
  $ sfdx cli tarballs verify

  $ sfdx cli tarballs verify --cli sfdx

  $ sfdx cli tarballs verify --cli sf
```

_See code: [src/commands/cli/tarballs/verify.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/tarballs/verify.ts)_

## `sfdx cli versions inspect`

inspect the CLI version across all install paths

```
USAGE
  $ sfdx cli versions inspect -c legacy|stable|stable-rc|latest|latest-rc|nightly -l archive|npm --cli sf|sfdx [--json]
    [-d <value>] [-s]

FLAGS
  -c, --channels=<option>...     (required) the channel you want to inspect (for achives, latest and latest-rc are
                                 translated to stable and stable-rc. And vice-versa for npm)
                                 <options: legacy|stable|stable-rc|latest|latest-rc|nightly>
  -d, --dependencies=<value>...  glob pattern of dependencies you want to see the version of
  -l, --locations=<option>...    (required) the location you want to inspect
                                 <options: archive|npm>
  -s, --salesforce               show versions of salesforce owned dependencies
      --cli=<option>             (required) [default: sfdx] the CLI you want to inspect
                                 <options: sf|sfdx>

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  inspect the CLI version across all install paths

  inspect the CLI version across all install paths

EXAMPLES
  $ sfdx cli versions inspect -l archive -c stable

  $ sfdx cli versions inspect -l archive -c stable-rc

  $ sfdx cli versions inspect -l archive npm -c stable

  $ sfdx cli versions inspect -l archive npm -c latest

  $ sfdx cli versions inspect -l archive npm -c latest latest-rc

  $ sfdx cli versions inspect -l archive npm -c stable stable-rc

  $ sfdx cli versions inspect -l npm -c latest --salesforce

  $ sfdx cli versions inspect -l npm -c latest -d @salesforce/core

  $ sfdx cli versions inspect -l npm -c latest -d @salesforce/\*\*/ salesforce-alm

  $ sfdx cli versions inspect -l npm -c latest -d chalk -s
```

_See code: [src/commands/cli/versions/inspect.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/cli/versions/inspect.ts)_

## `sfdx dependabot automerge`

automatically merge one green, mergeable PR up to the specified maximum bump type

```
USAGE
  $ sfdx dependabot automerge -m major|minor|patch [--json] [-o <value> -r <value>] [-d] [-s] [--merge-method
    merge|squash|rebase]

FLAGS
  -d, --dryrun                     only show what would happen if you consolidated dependabot PRs
  -m, --max-version-bump=<option>  (required) [default: minor] the maximum version bump you want to be included
                                   <options: major|minor|patch>
  -o, --owner=<value>              the organization that the repository belongs to. This defaults to the owner specified
                                   in the package.json
  -r, --repo=<value>               the repository you want to consolidate PRs on. This defaults to the repository
                                   specified in the package.json
  -s, --skip-ci                    add [skip ci] to the merge commit title
      --merge-method=<option>      [default: merge] merge method to use
                                   <options: merge|squash|rebase>

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  automatically merge one green, mergeable PR up to the specified maximum bump type

  automatically merge one green, mergeable PR up to the specified maximum bump type

EXAMPLES
  $ sfdx dependabot automerge --max-version-bump patch

  $ sfdx dependabot automerge --max-version-bump minor

  $ sfdx dependabot automerge --max-version-bump major
```

_See code: [src/commands/dependabot/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/dependabot/automerge.ts)_

## `sfdx github check closed`

Show open Github issues with GUS WI

```
USAGE
  $ sfdx github check closed -o <value> --github-token <value> [--json]

FLAGS
  -o, --gus=<value>           (required) Username/alias of your GUS org connection
      --github-token=<value>  (required) Github token--store this in the environment as GITHUB_TOKEN

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show open Github issues with GUS WI

  Description of a command.

EXAMPLES
  $ sfdx github check closed -o me@gus.com
```

_See code: [src/commands/github/check/closed.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/github/check/closed.ts)_

## `sfdx npm dependencies pin`

lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry in the package.json

```
USAGE
  $ sfdx npm dependencies pin [--json] [-d] [-t <value>]

FLAGS
  -d, --dryrun       If true, will not make any changes to the package.json
  -t, --tag=<value>  [default: latest] The name of the tag you want, e.g. 'latest-rc', or 'latest'

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry
  in the package.json

  lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry
  in the package.json
```

_See code: [src/commands/npm/dependencies/pin.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/npm/dependencies/pin.ts)_

## `sfdx npm package release`

publish npm package

```
USAGE
  $ sfdx npm package release [--json] [-d] [-s] [-t <value>] [-a <value>] [--install] [--prerelease <value>] [--verify]
    [--githubtag <value>]

FLAGS
  -a, --npmaccess=<value>   [default: public] access level to use when publishing to npm
  -d, --dryrun              If true, will not commit changes to repo or push any tags
  -s, --sign                If true, then the package will be signed and the signature will be uploaded to S3
  -t, --npmtag=<value>      [default: latest] tag to use when publishing to npm
      --githubtag=<value>   given a github tag, release the version specified in the package.json as is. Useful when
                            you've already done a release and only need npm publish features
      --[no-]install        run yarn install and build on repository
      --prerelease=<value>  determine the next version as <version>-<prerelease>.0 if version is not manually set
      --[no-]verify         verify npm registry has new version after publish and digital signature

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  publish npm package

  publish npm package
```

_See code: [src/commands/npm/package/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/npm/package/release.ts)_

## `sfdx plugins trust verify`

Validate a digital signature.

```
USAGE
  $ sfdx plugins trust verify -n <value> [--json] [-r <value>]

FLAGS
  -n, --npm=<value>       (required) Specify the npm name. This can include a tag/version.
  -r, --registry=<value>  The registry name. The behavior is the same as npm.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validate a digital signature.

  Verifies the digital signature on an npm package matches the signature and key stored at the expected URLs.

EXAMPLES
  $ sfdx plugins trust verify --npm @scope/npmName --registry https://npm.pkg.github.com

  $ sfdx plugins trust verify --npm @scope/npmName
```

_See code: [@salesforce/plugin-trust](https://github.com/salesforcecli/plugin-trust/blob/3.3.10/src/commands/plugins/trust/verify.ts)_

## `sfdx repositories`

list repositories owned and supported by Salesforce CLI

```
USAGE
  $ sfdx repositories [--json] [--columns <value> | -x] [--filter <value>] [--no-header | [--csv | --no-truncate]]
    [--output csv|json|yaml |  | ] [--sort <value>]

FLAGS
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  list repositories owned and supported by Salesforce CLI
  For more information on the list of repositories, visit https://github.com/salesforcecli/status.

  list repositories owned and supported by Salesforce CLI
  For more information on the list of repositories, visit https://github.com/salesforcecli/status.

EXAMPLES
  $ sfdx repositories --columns=url --filter='Name=sfdx-core' --no-header | xargs open

  $ sfdx repositories --json | jq -r '.result[] | select(.name=="sfdx-core") | .packages[] | .url
```

_See code: [src/commands/repositories/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.7.20/src/commands/repositories/index.ts)_

<!-- commandsstop -->
