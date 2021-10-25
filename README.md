# plugin-release-management

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-release-management.svg?label=@salesforce/plugin-release-management)](https://www.npmjs.com/package/@salesforce/plugin-release-management) [![CircleCI](https://circleci.com/gh/salesforcecli/plugin-release-management/tree/main.svg?style=shield)](https://circleci.com/gh/salesforcecli/plugin-release-management/tree/main) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-release-management.svg)](https://npmjs.org/package/@salesforce/plugin-release-management) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-release-management/main/LICENSE.txt)

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

To use your plugin, run using the local `./bin/run` or `./bin/run.cmd` file.

```bash
# Run using local run file.
./bin/run npm
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
* [`sfdx channel:promote -t <string> -p <array> -c sf|sfdx [-d] [-m <number>] [-i] [-x] [-T <array>] [-T <string> |  | [-C <string> | -s <string>]] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-channelpromote--t-string--p-array--c-sfsfdx--d--m-number--i--x--t-array--t-string-----c-string---s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx circleci [-t plugin|library|orb] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circleci--t-pluginlibraryorb---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circlecienvvarcreate--e-string--s-string---dryrun---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circlecienvvarupdate--e-string--s-string---dryrun---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-cliinstalltest--c-string--m-string---channel-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:latestrc:build [--rctag <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clilatestrcbuild---rctag-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clischemascollect---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clischemascompare---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clitarballsprepare--d--t---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clitarballsverify--c-sfsfdx--w-number---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-cliversionsinspect--c-string--l-string---cli-sfsfdx--d-string--s---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx dependabot:automerge -m major|minor|patch [-r <string> -o <string>] [-d] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-dependabotautomerge--m-majorminorpatch--r-string--o-string--d--s---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r <string> -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-dependabotconsolidate--m-majorminorpatch--b-string--t-string---ignore-array--d---no-pr--r-string--o-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmdependenciespin--d--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--verify] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmlernarelease--d--s-array--t-string--a-string---install---githubrelease---verify---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmpackagepromote--c-string--d--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmpackagerelease--d--s--t-string--a-string---install---prerelease-string---verify---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx npm:release:validate [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmreleasevalidate---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-pluginstrustverify--n-string--r-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx `](#sfdx-)
* [`sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-typescriptupdate--v-string--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx channel:promote -t <string> -p <array> -c sf|sfdx [-d] [-m <number>] [-i] [-x] [-T <array>] [-T <string> |  | [-C <string> | -s <string>]] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

promote a s3 channel

```
USAGE
  $ sfdx channel:promote -t <string> -p <array> -c sf|sfdx [-d] [-m <number>] [-i] [-x] [-T <array>] [-T <string> |  | 
  [-C <string> | -s <string>]] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -C, --candidate=candidate                                                         the channel name that you want to
                                                                                    promote

  -T, --targets=targets                                                             comma-separated targets to promote
                                                                                    (e.g.: linux-arm,win32-x64)

  -T, --version=version                                                             the version of the candidate to be
                                                                                    promoted, which must exist already
                                                                                    in s3. Used to fetch the correct sha

  -c, --cli=(sf|sfdx)                                                               (required) the cli name to promote

  -d, --dryrun                                                                      If true, only show what would happen

  -i, --[no-]indexes                                                                append the promoted urls into the
                                                                                    index files

  -m, --maxage=maxage                                                               [default: 300] cache control max-age
                                                                                    in seconds

  -p, --platform=platform                                                           (required) the platform to promote

  -s, --sha=sha                                                                     the short sha to promote

  -t, --target=target                                                               (required) [default: stable] the
                                                                                    channel name that you are promoting
                                                                                    to

  -x, --[no-]xz                                                                     also upload xz

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx channel:promote --candidate latest-rc --target latest --platform win --platform mac
```

_See code: [src/commands/channel/promote.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/channel/promote.ts)_

## `sfdx circleci [-t plugin|library|orb] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

list known Circle CI slugs from 'sfdx repositories'

```
USAGE
  $ sfdx circleci [-t plugin|library|orb] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -t, --contains-package-type=(plugin|library|orb)                                  filter based on type of package
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx circleci -t plugin
```

_See code: [src/commands/circleci/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/circleci/index.ts)_

## `sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

update environment variable(s) on Circle CI slug(s)

```
USAGE
  $ sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -e, --envvar=envvar                                                               (required) a environment variables
                                                                                    to set on the given circle slug(s)

  -s, --slug=slug                                                                   a circle ci slugs in the format
                                                                                    <vcs>/<org name>/<repo name>

  --dryrun                                                                          do validation but do not update the
                                                                                    environment variable values

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Updates one or more environment variables on one or more CIrcle CI slugs. The environment variables must already exist 
  on the slug. You will be prompted for the environment variable values unless they already exist on the process. The 
  slugs can be piped in. If so, the environment variables must be on the process (prompting is disabled).

EXAMPLES
  sfdx circleci:envvar:create -e 'MY_ENV_VAR' -s 'gh/<org>/<repository>'
  echo "gh/<org>/<repository>" | sfdx circleci:envvar:create -e 'MY_ENV_VAR'
  sfdx circleci -t plugin | sfdx circleci:envvar:create -e 'MY_ENV_VAR' -e 'MY_OTHER_ENV_VAR'
```

_See code: [src/commands/circleci/envvar/create.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/circleci/envvar/create.ts)_

## `sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

update environment variable(s) on Circle CI slug(s)

```
USAGE
  $ sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -e, --envvar=envvar                                                               (required) a environment variables
                                                                                    to set on the given circle slug(s)

  -s, --slug=slug                                                                   a circle ci slugs in the format
                                                                                    <vcs>/<org name>/<repo name>

  --dryrun                                                                          do validation but do not update the
                                                                                    environment variable values

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Updates one or more environment variables on one or more CIrcle CI slugs. The environment variables must already exist 
  on the slug. You will be prompted for the environment variable values unless they already exist on the process. The 
  slugs can be piped in. If so, the environment variables must be on the process (prompting is disabled).

EXAMPLES
  sfdx circleci:envvar:update -e 'MY_ENV_VAR' -s 'gh/<org>/<repository>'
  echo "gh/<org>/<repository>" | sfdx circleci:envvar:update -e 'MY_ENV_VAR'
  sfdx circleci -t plugin | sfdx circleci:envvar:update -e 'MY_ENV_VAR' -e 'MY_OTHER_ENV_VAR'
```

_See code: [src/commands/circleci/envvar/update.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/circleci/envvar/update.ts)_

## `sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

install sf or sfdx

```
USAGE
  $ sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --cli=sf|sfdx                                                                 (required) the cli to install

  -m, --method=installer|npm|tarball                                                (required) the installation method
                                                                                    to use

  --channel=legacy|stable|stable-rc|latest|latest-rc                                [default: stable] the channel to
                                                                                    install from

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx cli:install:test --cli sfdx --method installer
  sfdx cli:install:test --cli sfdx --method npm
  sfdx cli:install:test --cli sfdx --method tarball
  sfdx cli:install:test --cli sf --method tarball
  sfdx cli:install:test --cli sf --method tarball --channel stable-rc
```

_See code: [src/commands/cli/install/test.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/install/test.ts)_

## `sfdx cli:latestrc:build [--rctag <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

creates a PR to the repository property defined in the package.json to release a latest-rc build

```
USAGE
  $ sfdx cli:latestrc:build [--rctag <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --rctag=rctag                                                                     [default: latest-rc] the tag name
                                                                                    that corresponds to the npm RC
                                                                                    build, usually latest-rc or
                                                                                    stable-rc
```

_See code: [src/commands/cli/latestrc/build.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/latestrc/build.ts)_

## `sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

collect schemas from installed plugins

```
USAGE
  $ sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx cli:schemas:collect
```

_See code: [src/commands/cli/schemas/collect.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/schemas/collect.ts)_

## `sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

compare schemas from installed plugins

```
USAGE
  $ sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx cli:schemas:compare
```

_See code: [src/commands/cli/schemas/compare.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/schemas/compare.ts)_

## `sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

remove unnecessary files from node_modules

```
USAGE
  $ sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --dryrun                                                                      only show what would be removed from
                                                                                    node_modules

  -t, --types                                                                       remove all types (.d.ts) files from
                                                                                    node_modules

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --verbose                                                                         show all files paths being removed

EXAMPLE
  sfdx cli:tarballs:prepare
```

_See code: [src/commands/cli/tarballs/prepare.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/tarballs/prepare.ts)_

## `sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

verify that tarballs are ready to be uploaded

```
USAGE
  $ sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --cli=(sf|sfdx)                                                               [default: sfdx] the cli to verify

  -w, --windows-username-buffer=windows-username-buffer                             [default: 41] the number of
                                                                                    characters to allow for windows
                                                                                    usernames

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx cli:tarballs:verify
  sfdx cli:tarballs:verify --cli sfdx
  sfdx cli:tarballs:verify --cli sf
```

_See code: [src/commands/cli/tarballs/verify.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/tarballs/verify.ts)_

## `sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

inspect the CLI version across all install paths

```
USAGE
  $ sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --channels=legacy|stable|stable-rc|latest|latest-rc                           (required) the channel you want to
                                                                                    inspect (for achives, latest and
                                                                                    latest-rc are translated to stable
                                                                                    and stable-rc. And vice-versa for
                                                                                    npm)

  -d, --dependencies=dependencies                                                   glob pattern of dependencies you
                                                                                    want to see the version of

  -l, --locations=archive|npm                                                       (required) the location you want to
                                                                                    inspect

  -s, --salesforce                                                                  show versions of salesforce owned
                                                                                    dependencies

  --cli=(sf|sfdx)                                                                   (required) [default: sfdx] the CLI
                                                                                    you want to inspect

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx cli:versions:inspect -l archive -c stable
  sfdx cli:versions:inspect -l archive -c stable-rc
  sfdx cli:versions:inspect -l archive npm -c stable
  sfdx cli:versions:inspect -l archive npm -c latest
  sfdx cli:versions:inspect -l archive npm -c latest latest-rc
  sfdx cli:versions:inspect -l archive npm -c stable stable-rc
  sfdx cli:versions:inspect -l npm -c latest --salesforce
  sfdx cli:versions:inspect -l npm -c latest -d @salesforce/core
  sfdx cli:versions:inspect -l npm -c latest -d @salesforce/**/ salesforce-alm
  sfdx cli:versions:inspect -l npm -c latest -d chalk -s
```

_See code: [src/commands/cli/versions/inspect.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/cli/versions/inspect.ts)_

## `sfdx dependabot:automerge -m major|minor|patch [-r <string> -o <string>] [-d] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

automatically merge one green, mergeable PR up to the specified maximum bump type

```
USAGE
  $ sfdx dependabot:automerge -m major|minor|patch [-r <string> -o <string>] [-d] [-s] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --dryrun                                                                      only show what would happen if you
                                                                                    consolidated dependabot PRs

  -m, --max-version-bump=(major|minor|patch)                                        (required) [default: minor] the
                                                                                    maximum version bump you want to be
                                                                                    included

  -o, --owner=owner                                                                 the organization that the repository
                                                                                    belongs to. This defaults to the
                                                                                    owner specified in the package.json

  -r, --repo=repo                                                                   the repository you want to
                                                                                    consolidate PRs on. This defaults to
                                                                                    the repository specified in the
                                                                                    package.json

  -s, --skip-ci                                                                     add [skip ci] to the merge commit
                                                                                    title

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx dependabot:automerge --max-version-bump patch
  sfdx dependabot:automerge --max-version-bump minor
  sfdx dependabot:automerge --max-version-bump major
```

_See code: [src/commands/dependabot/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/dependabot/automerge.ts)_

## `sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r <string> -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

consolidate dependabot PRs into a single PR

```
USAGE
  $ sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r 
  <string> -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --base-branch=base-branch                                                     (required) [default: main] name of
                                                                                    the base branch for merging

  -d, --dryrun                                                                      only show what would happen if you
                                                                                    consolidated dependabot PRs

  -m, --max-version-bump=(major|minor|patch)                                        (required) [default: minor] the
                                                                                    maximum version bump you want to be
                                                                                    included

  -o, --owner=owner                                                                 the organization that the repository
                                                                                    belongs to. This defaults to the
                                                                                    owner specified in the package.json

  -r, --repo=repo                                                                   the repository you want to
                                                                                    consolidate PRs on. This defaults to
                                                                                    the repository specified in the
                                                                                    package.json

  -t, --target-branch=target-branch                                                 (required) [default:
                                                                                    consolidate-dependabot] name of the
                                                                                    target branch for merging

  --ignore=ignore                                                                   [default: ] ignore any PRs with
                                                                                    titles that include this value

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --no-pr                                                                           do everything but create the PR

EXAMPLES
  sfdx dependabot:consolidate --max-version-bump patch
  sfdx dependabot:consolidate --max-version-bump minor
  sfdx dependabot:consolidate --max-version-bump major
```

_See code: [src/commands/dependabot/consolidate.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/dependabot/consolidate.ts)_

## `sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry in the package.json

```
USAGE
  $ sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --dryrun                                                                      If true, will not make any changes
                                                                                    to the package.json

  -t, --tag=tag                                                                     [default: latest] The name of the
                                                                                    tag you want, e.g. 'latest-rc', or
                                                                                    'latest'

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/npm/dependencies/pin.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/npm/dependencies/pin.ts)_

## `sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--verify] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

publish npm packages from a lerna repository

```
USAGE
  $ sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--verify] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --npmaccess=npmaccess                                                         [default: public] access level to
                                                                                    use when publishing to npm

  -d, --dryrun                                                                      if true, will not commit changes to
                                                                                    repo or push any tags

  -s, --sign=sign                                                                   list of packages to be signed.
                                                                                    Should match the name property of
                                                                                    the package.json

  -t, --npmtag=npmtag                                                               [default: latest] tag to use when
                                                                                    publishing to npm

  --githubrelease                                                                   create release in github based on
                                                                                    the package changes

  --[no-]install                                                                    run yarn install and build on
                                                                                    repository

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --[no-]verify                                                                     verify npm registry has new version
                                                                                    after publish and digital signature
```

_See code: [src/commands/npm/lerna/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/npm/lerna/release.ts)_

## `sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

promote an npm package

```
USAGE
  $ sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --candidate=candidate                                                         (required) the npm tag that you want
                                                                                    to promote

  -d, --dryrun                                                                      If true, only show what would happen

  -t, --target=target                                                               [default: latest] the npm tag that
                                                                                    you are promoting to

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  sfdx npm:package:promote --candidate latest-rc --target latest
```

_See code: [src/commands/npm/package/promote.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/npm/package/promote.ts)_

## `sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

publish npm package

```
USAGE
  $ sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --npmaccess=npmaccess                                                         [default: public] access level to
                                                                                    use when publishing to npm

  -d, --dryrun                                                                      If true, will not commit changes to
                                                                                    repo or push any tags

  -s, --sign                                                                        If true, then the package will be
                                                                                    signed and the signature will be
                                                                                    uploaded to S3

  -t, --npmtag=npmtag                                                               [default: latest] tag to use when
                                                                                    publishing to npm

  --[no-]install                                                                    run yarn install and build on
                                                                                    repository

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --prerelease=prerelease                                                           determine the next version as
                                                                                    <version>-<prerelease>.0 if version
                                                                                    is not manually set

  --[no-]verify                                                                     verify npm registry has new version
                                                                                    after publish and digital signature
```

_See code: [src/commands/npm/package/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/npm/package/release.ts)_

## `sfdx npm:release:validate [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

inspects the git commits to see if there are any commits that will warrant a new release

```
USAGE
  $ sfdx npm:release:validate [--verbose] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --verbose                                                                         show all commits for all packages
                                                                                    (only works with --json flag)
```

_See code: [src/commands/npm/release/validate.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/npm/release/validate.ts)_

## `sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

validate a digital signature for a npm package

```
USAGE
  $ sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --npm=npm                                                                     (required) Specify the npm name.
                                                                                    This can include a tag/version

  -r, --registry=registry                                                           The registry name. the behavior is
                                                                                    the same as npm

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  sfdx plugins:trust:verify --npm @scope/npmName --registry http://my.repo.org:4874
  sfdx plugins:trust:verify --npm @scope/npmName
```

_See code: [@salesforce/plugin-trust](https://github.com/salesforcecli/plugin-trust/blob/v1.0.9/src/commands/plugins/trust/verify.ts)_

## `sfdx `

list repositories owned and supported by Salesforce CLI

```
USAGE
  $ sfdx repositories

OPTIONS
  -x, --extended                                                                    show extra columns

  --columns=columns                                                                 only show provided columns
                                                                                    (comma-separated)

  --csv                                                                             output is csv format [alias:
                                                                                    --output=csv]

  --filter=filter                                                                   filter property by partial string
                                                                                    matching, ex: name=foo

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --no-header                                                                       hide table header from output

  --no-truncate                                                                     do not truncate output to fit screen

  --output=csv|json|yaml                                                            output in a more machine friendly
                                                                                    format

  --sort=sort                                                                       property to sort by (prepend '-' for
                                                                                    descending)

DESCRIPTION
  For more information on the list of repositories, visit https://github.com/salesforcecli/status.

EXAMPLES
  sfdx repositories --columns=url --filter='Name=sfdx-core' --no-header | xargs open
  sfdx repositories --json | jq -r '.result[] | select(.name=="sfdx-core") | .packages[] | .url
```

_See code: [src/commands/repositories/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/repositories/index.ts)_

## `sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Runs tests with updated typescript version and ES target

```
USAGE
  $ sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -t, --target=target                                                               [default: ESNext] Specify the ES
                                                                                    target you'd like to use. Defaults
                                                                                    to ESNext if not specified

  -v, --version=version                                                             [default: latest] Specify the
                                                                                    typescript version you'd like to
                                                                                    update to. Defaults to latest if not
                                                                                    specified

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/typescript/update.ts](https://github.com/salesforcecli/plugin-release-management/blob/v2.5.0/src/commands/typescript/update.ts)_
<!-- commandsstop -->
