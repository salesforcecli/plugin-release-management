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

- [`sfdx cli:artifacts:compare`](#sfdx-cliartifactscompare)
- [`sfdx cli:install:jit:test`](#sfdx-cliinstalljittest)
- [`sfdx cli:release:automerge`](#sfdx-clireleaseautomerge)
- [`sfdx cli:schemas:compare`](#sfdx-clischemascompare)
- [`sfdx cli:tarballs:smoke`](#sfdx-clitarballssmoke)
- [`sfdx dependabot:automerge`](#sfdx-dependabotautomerge)
- [`sfdx github:check:closed`](#sfdx-githubcheckclosed)
- [`sfdx plugins:trust:verify`](#sfdx-pluginstrustverify)
- [`sfdx repositories`](#sfdx-repositories)

## `sfdx cli:artifacts:compare`

Look for breaking changes in artifacts (schemas and snapshots) from plugins. Must be run in CLI directory.

```
USAGE
  $ sfdx cli:artifacts:compare [--json] [-p <value>] [-r <value>] [-c <value>]

FLAGS
  -c, --current=<value>    Current CLI version to compare against. Defaults to the version on the CLI in the current
                           directory.
  -p, --plugin=<value>...  List of plugins to check for breaking changes.
  -r, --previous=<value>   Previous CLI version to compare against. Defaults to the last published version.

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  $ sfdx cli:artifacts:compare
```

_See code: [src/commands/cli/artifacts/compare.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/cli/artifacts/compare.ts)_

## `sfdx cli:install:jit:test`

Test that all JIT plugins can be successfully installed.

```
USAGE
  $ sfdx cli:install:jit:test [--json] [-j <value>]

FLAGS
  -j, --jit-plugin=<value>...  JIT plugin(s) to test, example: @salesforce/plugin-community

GLOBAL FLAGS
  --json  Format output as json.

EXAMPLES
  $ sfdx cli:install:jit:test
```

_See code: [src/commands/cli/install/jit/test.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/cli/install/jit/test.ts)_

## `sfdx cli:release:automerge`

Attempt to automerge nightly PR

```
USAGE
  $ sfdx cli:release:automerge (--owner <value> --repo <value>) --pull-number <value> [--json] [-d] [--verbose]

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
  $ sfdx cli:release:automerge --owner salesforcecli --repo sfdx-cli --pul-number 1049
```

_See code: [src/commands/cli/release/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/cli/release/automerge.ts)_

## `sfdx cli:schemas:compare`

compare schemas from installed plugins

```
USAGE
  $ sfdx cli:schemas:compare [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  compare schemas from installed plugins

  compare schemas from installed plugins

EXAMPLES
  $ sfdx cli:schemas:compare
```

_See code: [src/commands/cli/schemas/compare.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/cli/schemas/compare.ts)_

## `sfdx cli:tarballs:smoke`

smoke tests for the sf CLI

```
USAGE
  $ sfdx cli:tarballs:smoke [--json] [--verbose]

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
  $ sfdx cli:tarballs:smoke

  $ sfdx cli:tarballs:smoke
```

_See code: [src/commands/cli/tarballs/smoke.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/cli/tarballs/smoke.ts)_

## `sfdx dependabot:automerge`

automatically merge one green, mergeable PR up to the specified maximum bump type

```
USAGE
  $ sfdx dependabot:automerge -m major|minor|patch [--json] [-o <value> -r <value>] [-d] [-s] [--merge-method
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
  $ sfdx dependabot:automerge --max-version-bump patch

  $ sfdx dependabot:automerge --max-version-bump minor

  $ sfdx dependabot:automerge --max-version-bump major
```

_See code: [src/commands/dependabot/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/dependabot/automerge.ts)_

## `sfdx github:check:closed`

Show open Github issues with GUS WI

```
USAGE
  $ sfdx github:check:closed -o <value> --github-token <value> [--json]

FLAGS
  -o, --gus=<value>           (required) Username/alias of your GUS org connection
      --github-token=<value>  (required) Github token--store this in the environment as GITHUB_TOKEN

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show open Github issues with GUS WI

  Description of a command.

EXAMPLES
  $ sfdx github:check:closed -o me@gus.com
```

_See code: [src/commands/github/check/closed.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/github/check/closed.ts)_

## `sfdx plugins:trust:verify`

Validate a digital signature.

```
USAGE
  $ sfdx plugins:trust:verify -n <value> [--json] [-r <value>]

FLAGS
  -n, --npm=<value>       (required) Specify the npm name. This can include a tag/version.
  -r, --registry=<value>  The registry name. The behavior is the same as npm.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validate a digital signature.

  Verifies the digital signature on an npm package matches the signature and key stored at the expected URLs.

EXAMPLES
  $ sfdx plugins:trust:verify --npm @scope/npmName --registry http://my.repo.org:4874

  $ sfdx plugins:trust:verify --npm @scope/npmName
```

_See code: [@salesforce/plugin-trust](https://github.com/salesforcecli/plugin-trust/blob/2.6.23/src/commands/plugins/trust/verify.ts)_

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

_See code: [src/commands/repositories/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/4.5.22/src/commands/repositories/index.ts)_

<!-- commandsstop -->
