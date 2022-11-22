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

- [`sfdx channel:promote -t <string> -c sf|sfdx [-d] [-p <array>] [-m <number>] [-i] [-x] [-T <array>] [-T <string> | | [-C <string> | -s <string>]] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-channelpromote--t-string--c-sfsfdx--d--p-array--m-number--i--x--t-array--t-string-----c-string---s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx circleci [-t plugin|library|orb] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circleci--t-pluginlibraryorb---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circlecienvvarcreate--e-string--s-string---dryrun---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circlecienvvarupdate--e-string--s-string---dryrun---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--output-file <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-cliinstalltest--c-string--m-string---channel-string---output-file-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:latestrc:build [--rctag <string>] [--build-only] [--resolutions] [--only <array>] [--pinned-deps] [--patch] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clilatestrcbuild---rctag-string---build-only---resolutions---only-array---pinned-deps---patch---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:releasenotes -c <string> [-s <string>] [-m] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clireleasenotes--c-string--s-string--m---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clischemascollect---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clischemascompare---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clitarballsprepare--d--t---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:tarballs:smoke -c <string> [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clitarballssmoke--c-string---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-clitarballsverify--c-sfsfdx--w-number---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-cliversionsinspect--c-string--l-string---cli-sfsfdx--d-string--s---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx dependabot:automerge -m major|minor|patch [-o <string> -r <string>] [-d] [-s] [--merge-method merge|squash|rebase] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-dependabotautomerge--m-majorminorpatch--o-string--r-string--d--s---merge-method-mergesquashrebase---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r <string> -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-dependabotconsolidate--m-majorminorpatch--b-string--t-string---ignore-array--d---no-pr--r-string--o-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmdependenciespin--d--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmpackagepromote--c-string--d--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify] [--githubtag <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmpackagerelease--d--s--t-string--a-string---install---prerelease-string---verify---githubtag-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:release:validate [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmreleasevalidate---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-pluginstrustverify--n-string--r-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx`](#sfdx)
- [`sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-typescriptupdate--v-string--t-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx channel:promote -t <string> -c sf|sfdx [-d] [-p <array>] [-m <number>] [-i] [-x] [-T <array>] [-T <string> | | [-C <string> | -s <string>]] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

promote a s3 channel

```
USAGE
  $ sfdx channel:promote -t <string> -c sf|sfdx [-d] [-p <array>] [-m <number>] [-i] [-x] [-T <array>] [-T <string> |
    | [-C <string> | -s <string>]] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -C, --candidate=<value>                                                           the channel name that you want to
                                                                                    promote
  -T, --targets=<value>                                                             comma-separated targets to promote
                                                                                    (e.g.: linux-arm,win32-x64)
  -T, --version=<value>                                                             the version of the candidate to be
                                                                                    promoted, which must exist already
                                                                                    in s3. Used to fetch the correct sha
  -c, --cli=(sf|sfdx)                                                               (required) the cli name to promote
  -d, --dryrun                                                                      If true, only show what would happen
  -i, --[no-]indexes                                                                append the promoted urls into the
                                                                                    index files
  -m, --maxage=<value>                                                              [default: 300] cache control max-age
                                                                                    in seconds
  -p, --platform=<value>...                                                         [default: ] the platform to promote
  -s, --sha=<value>                                                                 the short sha to promote
  -t, --target=<value>                                                              (required) [default: stable] the
                                                                                    channel name that you are promoting
                                                                                    to
  -x, --[no-]xz                                                                     also upload xz
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  promote a s3 channel

EXAMPLES
  $ sfdx channel:promote --candidate latest-rc --target latest --platform win --platform mac
```

_See code: [src/commands/channel/promote.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/channel/promote.ts)_

## `sfdx circleci [-t plugin|library|orb] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

list known Circle CI slugs from 'sfdx repositories'

```
USAGE
  $ sfdx circleci [-t plugin|library|orb] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -t, --contains-package-type=(plugin|library|orb)                                  filter based on type of package
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  list known Circle CI slugs from 'sfdx repositories'

EXAMPLES
  $ sfdx circleci -t plugin
```

_See code: [src/commands/circleci/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/circleci/index.ts)_

## `sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

update environment variable(s) on Circle CI slug(s)

```
USAGE
  $ sfdx circleci:envvar:create -e <string> [-s <string>] [--dryrun] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -e, --envvar=<value>...                                                           (required) a environment variables
                                                                                    to set on the given circle slug(s)
  -s, --slug=<value>...                                                             a circle ci slugs in the format
                                                                                    <vcs>/<org name>/<repo name>
  --dryrun                                                                          do validation but do not update the
                                                                                    environment variable values
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  update environment variable(s) on Circle CI slug(s)

  Updates one or more environment variables on one or more CIrcle CI slugs. The environment variables must already exist
  on the slug. You will be prompted for the environment variable values unless they already exist on the process. The
  slugs can be piped in. If so, the environment variables must be on the process (prompting is disabled).

EXAMPLES
  $ sfdx circleci:envvar:create -e 'MY_ENV_VAR' -s 'gh/<org>/<repository>'

  echo "gh/<org>/<repository>" | sfdx circleci:envvar:create -e 'MY_ENV_VAR'

  $ sfdx circleci -t plugin | sfdx circleci:envvar:create -e 'MY_ENV_VAR' -e 'MY_OTHER_ENV_VAR'
```

_See code: [src/commands/circleci/envvar/create.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/circleci/envvar/create.ts)_

## `sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

update environment variable(s) on Circle CI slug(s)

```
USAGE
  $ sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -e, --envvar=<value>...                                                           (required) a environment variables
                                                                                    to set on the given circle slug(s)
  -s, --slug=<value>...                                                             a circle ci slugs in the format
                                                                                    <vcs>/<org name>/<repo name>
  --dryrun                                                                          do validation but do not update the
                                                                                    environment variable values
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  update environment variable(s) on Circle CI slug(s)

  Updates one or more environment variables on one or more CIrcle CI slugs. The environment variables must already exist
  on the slug. You will be prompted for the environment variable values unless they already exist on the process. The
  slugs can be piped in. If so, the environment variables must be on the process (prompting is disabled).

EXAMPLES
  $ sfdx circleci:envvar:update -e 'MY_ENV_VAR' -s 'gh/<org>/<repository>'

  echo "gh/<org>/<repository>" | sfdx circleci:envvar:update -e 'MY_ENV_VAR'

  $ sfdx circleci -t plugin | sfdx circleci:envvar:update -e 'MY_ENV_VAR' -e 'MY_OTHER_ENV_VAR'
```

_See code: [src/commands/circleci/envvar/update.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/circleci/envvar/update.ts)_

## `sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--output-file <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

install sf or sfdx

```
USAGE
  $ sfdx cli:install:test -c <string> -m <string> [--channel <string>] [--output-file <string>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --cli=<option>                                                                (required) the cli to install
                                                                                    <options: sf|sfdx>
  -m, --method=<option>                                                             (required) the installation method
                                                                                    to use
                                                                                    <options: installer|npm|tarball>
  --channel=<option>                                                                [default: stable] the channel to
                                                                                    install from
                                                                                    <options: legacy|stable|stable-rc|la
                                                                                    test|latest-rc>
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --output-file=<value>                                                             [default: test-results.json] the
                                                                                    file to write the JSON results to
                                                                                    (must be .json)

DESCRIPTION
  install sf or sfdx

EXAMPLES
  $ sfdx cli:install:test --cli sfdx --method installer

  $ sfdx cli:install:test --cli sfdx --method npm

  $ sfdx cli:install:test --cli sfdx --method tarball

  $ sfdx cli:install:test --cli sf --method tarball

  $ sfdx cli:install:test --cli sf --method tarball --channel stable-rc
```

_See code: [src/commands/cli/install/test.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/install/test.ts)_

## `sfdx cli:latestrc:build [--rctag <string>] [--build-only] [--resolutions] [--only <array>] [--pinned-deps] [--patch] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

creates a PR to the repository property defined in the package.json to release a latest-rc build

```
USAGE
  $ sfdx cli:latestrc:build [--rctag <string>] [--build-only] [--resolutions] [--only <array>] [--pinned-deps] [--patch]
    [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  --build-only                                                                      only build the latest rc, do not git
                                                                                    add/commit/push
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --only=<value>                                                                    only bump the version of the
                                                                                    packages passed in, uses latest if
                                                                                    version is not provided
  --patch                                                                           bump the release as a patch of an
                                                                                    existing version, not a new minor
                                                                                    version
  --[no-]pinned-deps                                                                bump the versions of the packages
                                                                                    listed in the pinnedDependencies
                                                                                    section
  --rctag=<value>                                                                   [default: latest-rc] the tag name
                                                                                    that corresponds to the npm RC
                                                                                    build, usually latest-rc or
                                                                                    stable-rc
  --[no-]resolutions                                                                bump the versions of packages listed
                                                                                    in the resolutions section

DESCRIPTION
  creates a PR to the repository property defined in the package.json to release a latest-rc build

EXAMPLES
  $ sfdx cli:latestrc:build

  $ sfdx cli:latestrc:build --patch

  $ sfdx cli:latestrc:build --build-only

  $ sfdx cli:latestrc:build --only @salesforce/plugin-source,@salesforce/plugin-info@1.2.3,@sf/config
```

_See code: [src/commands/cli/latestrc/build.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/latestrc/build.ts)_

## `sfdx cli:releasenotes -c <string> [-s <string>] [-m] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

pull all relevant information for writing release notes.

```
USAGE
  $ sfdx cli:releasenotes -c <string> [-s <string>] [-m] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --cli=<option>                                                                (required) the cli to pull
                                                                                    information for
                                                                                    <options: sf|sfdx>
  -m, --markdown                                                                    format the output in markdown
  -s, --since=<value>                                                               the version number of the previous
                                                                                    release. Defaults to the latest-rc
                                                                                    version on npm
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  pull all relevant information for writing release notes.

  Requires the GH_TOKEN to be set in the environment.

EXAMPLES
  $ sfdx cli:releasenotes --cli sf

  $ sfdx cli:releasenotes --cli sfdx

  $ sfdx cli:releasenotes --cli sf --since 1.0.0

  $ sfdx cli:releasenotes --cli sfdx --since 7.19.0

  $ sfdx cli:releasenotes --cli sf > changes.txt

  $ sfdx cli:releasenotes --cli sf --markdown > changes.md
```

_See code: [src/commands/cli/releasenotes.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/releasenotes.ts)_

## `sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

collect schemas from installed plugins

```
USAGE
  $ sfdx cli:schemas:collect [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  collect schemas from installed plugins

EXAMPLES
  $ sfdx cli:schemas:collect
```

_See code: [src/commands/cli/schemas/collect.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/schemas/collect.ts)_

## `sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

compare schemas from installed plugins

```
USAGE
  $ sfdx cli:schemas:compare [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  compare schemas from installed plugins

EXAMPLES
  $ sfdx cli:schemas:compare
```

_See code: [src/commands/cli/schemas/compare.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/schemas/compare.ts)_

## `sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

remove unnecessary files from node_modules

```
USAGE
  $ sfdx cli:tarballs:prepare [-d] [-t] [--verbose] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -d, --dryrun                                                                      only show what would be removed from
                                                                                    node_modules
  -t, --types                                                                       remove all types (.d.ts) files from
                                                                                    node_modules
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --verbose                                                                         show all files paths being removed

DESCRIPTION
  remove unnecessary files from node_modules

EXAMPLES
  $ sfdx cli:tarballs:prepare
```

_See code: [src/commands/cli/tarballs/prepare.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/tarballs/prepare.ts)_

## `sfdx cli:tarballs:smoke -c <string> [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

smoke tests for the tarballed CLI

```
USAGE
  $ sfdx cli:tarballs:smoke -c <string> [--verbose] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --cli=<option>                                                                (required) the cli to install
                                                                                    <options: sf|sfdx>
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --verbose                                                                         show the --help output for each
                                                                                    command

DESCRIPTION
  smoke tests for the tarballed CLI

  Tests that the CLI and every command can be initialized.

EXAMPLES
  $ sfdx cli:tarballs:smoke --cli sfdx

  $ sfdx cli:tarballs:smoke --cli sf
```

_See code: [src/commands/cli/tarballs/smoke.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/tarballs/smoke.ts)_

## `sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

verify that tarballs are ready to be uploaded

```
USAGE
  $ sfdx cli:tarballs:verify [-c sf|sfdx] [-w <number>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --cli=(sf|sfdx)                                                               [default: sfdx] the cli to verify
  -w, --windows-username-buffer=<value>                                             [default: 41] the number of
                                                                                    characters to allow for windows
                                                                                    usernames
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  verify that tarballs are ready to be uploaded

EXAMPLES
  $ sfdx cli:tarballs:verify

  $ sfdx cli:tarballs:verify --cli sfdx

  $ sfdx cli:tarballs:verify --cli sf
```

_See code: [src/commands/cli/tarballs/verify.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/tarballs/verify.ts)_

## `sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

inspect the CLI version across all install paths

```
USAGE
  $ sfdx cli:versions:inspect -c <string> -l <string> --cli sf|sfdx [-d <string>] [-s] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --channels=<option>...
      (required) the channel you want to inspect (for achives, latest and latest-rc are translated to stable and
      stable-rc. And vice-versa for npm)
      <options: legacy|stable|stable-rc|latest|latest-rc>

  -d, --dependencies=<value>...
      glob pattern of dependencies you want to see the version of

  -l, --locations=<option>...
      (required) the location you want to inspect
      <options: archive|npm>

  -s, --salesforce
      show versions of salesforce owned dependencies

  --cli=(sf|sfdx)
      (required) [default: sfdx] the CLI you want to inspect

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

DESCRIPTION
  inspect the CLI version across all install paths

EXAMPLES
  $ sfdx cli:versions:inspect -l archive -c stable

  $ sfdx cli:versions:inspect -l archive -c stable-rc

  $ sfdx cli:versions:inspect -l archive npm -c stable

  $ sfdx cli:versions:inspect -l archive npm -c latest

  $ sfdx cli:versions:inspect -l archive npm -c latest latest-rc

  $ sfdx cli:versions:inspect -l archive npm -c stable stable-rc

  $ sfdx cli:versions:inspect -l npm -c latest --salesforce

  $ sfdx cli:versions:inspect -l npm -c latest -d @salesforce/core

  $ sfdx cli:versions:inspect -l npm -c latest -d @salesforce/**/ salesforce-alm

  $ sfdx cli:versions:inspect -l npm -c latest -d chalk -s
```

_See code: [src/commands/cli/versions/inspect.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/cli/versions/inspect.ts)_

## `sfdx dependabot:automerge -m major|minor|patch [-o <string> -r <string>] [-d] [-s] [--merge-method merge|squash|rebase] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

automatically merge one green, mergeable PR up to the specified maximum bump type

```
USAGE
  $ sfdx dependabot:automerge -m major|minor|patch [-o <string> -r <string>] [-d] [-s] [--merge-method
    merge|squash|rebase] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -d, --dryrun                                                                      only show what would happen if you
                                                                                    consolidated dependabot PRs
  -m, --max-version-bump=(major|minor|patch)                                        (required) [default: minor] the
                                                                                    maximum version bump you want to be
                                                                                    included
  -o, --owner=<value>                                                               the organization that the repository
                                                                                    belongs to. This defaults to the
                                                                                    owner specified in the package.json
  -r, --repo=<value>                                                                the repository you want to
                                                                                    consolidate PRs on. This defaults to
                                                                                    the repository specified in the
                                                                                    package.json
  -s, --skip-ci                                                                     add [skip ci] to the merge commit
                                                                                    title
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --merge-method=(merge|squash|rebase)                                              [default: merge] merge method to use

DESCRIPTION
  automatically merge one green, mergeable PR up to the specified maximum bump type

EXAMPLES
  $ sfdx dependabot:automerge --max-version-bump patch

  $ sfdx dependabot:automerge --max-version-bump minor

  $ sfdx dependabot:automerge --max-version-bump major
```

_See code: [src/commands/dependabot/automerge.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/dependabot/automerge.ts)_

## `sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r <string> -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

consolidate dependabot PRs into a single PR

```
USAGE
  $ sfdx dependabot:consolidate -m major|minor|patch -b <string> -t <string> [--ignore <array>] [-d] [--no-pr] [-r <string>
    -o <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -b, --base-branch=<value>                                                         (required) [default: main] name of
                                                                                    the base branch for merging
  -d, --dryrun                                                                      only show what would happen if you
                                                                                    consolidated dependabot PRs
  -m, --max-version-bump=(major|minor|patch)                                        (required) [default: minor] the
                                                                                    maximum version bump you want to be
                                                                                    included
  -o, --owner=<value>                                                               the organization that the repository
                                                                                    belongs to. This defaults to the
                                                                                    owner specified in the package.json
  -r, --repo=<value>                                                                the repository you want to
                                                                                    consolidate PRs on. This defaults to
                                                                                    the repository specified in the
                                                                                    package.json
  -t, --target-branch=<value>                                                       (required) [default:
                                                                                    consolidate-dependabot] name of the
                                                                                    target branch for merging
  --ignore=<value>                                                                  [default: ] ignore any PRs with
                                                                                    titles that include this value
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --no-pr                                                                           do everything but create the PR

DESCRIPTION
  consolidate dependabot PRs into a single PR

EXAMPLES
  $ sfdx dependabot:consolidate --max-version-bump patch

  $ sfdx dependabot:consolidate --max-version-bump minor

  $ sfdx dependabot:consolidate --max-version-bump major
```

_See code: [src/commands/dependabot/consolidate.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/dependabot/consolidate.ts)_

## `sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry in the package.json

```
USAGE
  $ sfdx npm:dependencies:pin [-d] [-t <string>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -d, --dryrun                                                                      If true, will not make any changes
                                                                                    to the package.json
  -t, --tag=<value>                                                                 [default: latest] The name of the
                                                                                    tag you want, e.g. 'latest-rc', or
                                                                                    'latest'
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  lock a list of dependencies to a target tag or default to 'latest', place these entries in 'pinnedDependencies' entry
  in the package.json
```

_See code: [src/commands/npm/dependencies/pin.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/npm/dependencies/pin.ts)_

## `sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

promote an npm package

```
USAGE
  $ sfdx npm:package:promote -c <string> [-d] [-t <string>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --candidate=<value>                                                           (required) the npm tag that you want
                                                                                    to promote
  -d, --dryrun                                                                      If true, only show what would happen
  -t, --target=<value>                                                              [default: latest] the npm tag that
                                                                                    you are promoting to
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  promote an npm package

EXAMPLES
  $ sfdx npm:package:promote --candidate latest-rc --target latest
```

_See code: [src/commands/npm/package/promote.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/npm/package/promote.ts)_

## `sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify] [--githubtag <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

publish npm package

```
USAGE
  $ sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--prerelease <string>] [--verify]
    [--githubtag <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -a, --npmaccess=<value>                                                           [default: public] access level to
                                                                                    use when publishing to npm
  -d, --dryrun                                                                      If true, will not commit changes to
                                                                                    repo or push any tags
  -s, --sign                                                                        If true, then the package will be
                                                                                    signed and the signature will be
                                                                                    uploaded to S3
  -t, --npmtag=<value>                                                              [default: latest] tag to use when
                                                                                    publishing to npm
  --githubtag=<value>                                                               given a github tag, release the
                                                                                    version specified in the
                                                                                    package.json as is. Useful when
                                                                                    you've already done a release and
                                                                                    only need npm publish features
  --[no-]install                                                                    run yarn install and build on
                                                                                    repository
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --prerelease=<value>                                                              determine the next version as
                                                                                    <version>-<prerelease>.0 if version
                                                                                    is not manually set
  --[no-]verify                                                                     verify npm registry has new version
                                                                                    after publish and digital signature

DESCRIPTION
  publish npm package
```

_See code: [src/commands/npm/package/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/npm/package/release.ts)_

## `sfdx npm:release:validate [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

inspects the git commits to see if there are any commits that will warrant a new release

```
USAGE
  $ sfdx npm:release:validate [--verbose] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --verbose                                                                         show all commits for all packages
                                                                                    (only works with --json flag)

DESCRIPTION
  inspects the git commits to see if there are any commits that will warrant a new release
```

_See code: [src/commands/npm/release/validate.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/npm/release/validate.ts)_

## `sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Validate a digital signature for a npm package.

```
USAGE
  $ sfdx plugins:trust:verify -n <string> [-r <string>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -n, --npm=<value>                                                                 (required) Specify the npm name.
                                                                                    This can include a tag/version.
  -r, --registry=<value>                                                            The registry name. The behavior is
                                                                                    the same as npm.
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Validate a digital signature for a npm package.

EXAMPLES
  $ sfdx plugins:trust:verify --npm @scope/npmName --registry http://my.repo.org:4874

  $ sfdx plugins:trust:verify --npm @scope/npmName
```

_See code: [@salesforce/plugin-trust](https://github.com/salesforcecli/plugin-trust/blob/v2.0.3/src/commands/plugins/trust/verify.ts)_

## `sfdx`

list repositories owned and supported by Salesforce CLI

```
USAGE
  $ sfdx repositories [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]
    [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]]
    [--no-header | ]

FLAGS
  -x, --extended                                                                    show extra columns
  --columns=<value>                                                                 only show provided columns
                                                                                    (comma-separated)
  --csv                                                                             output is csv format [alias:
                                                                                    --output=csv]
  --filter=<value>                                                                  filter property by partial string
                                                                                    matching, ex: name=foo
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --no-header                                                                       hide table header from output
  --no-truncate                                                                     do not truncate output to fit screen
  --output=<option>                                                                 output in a more machine friendly
                                                                                    format
                                                                                    <options: csv|json|yaml>
  --sort=<value>                                                                    property to sort by (prepend '-' for
                                                                                    descending)

DESCRIPTION
  list repositories owned and supported by Salesforce CLI

  For more information on the list of repositories, visit https://github.com/salesforcecli/status.

EXAMPLES
  $ sfdx repositories --columns=url --filter='Name=sfdx-core' --no-header | xargs open

  $ sfdx repositories --json | jq -r '.result[] | select(.name=="sfdx-core") | .packages[] | .url
```

_See code: [src/commands/repositories/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/repositories/index.ts)_

## `sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Runs tests with updated typescript version and ES target

```
USAGE
  $ sfdx typescript:update [-v <string>] [-t <string>] [--json] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -t, --target=<value>                                                              [default: ESNext] Specify the ES
                                                                                    target you'd like to use. Defaults
                                                                                    to ESNext if not specified
  -v, --version=<value>                                                             [default: latest] Specify the
                                                                                    typescript version you'd like to
                                                                                    update to. Defaults to latest if not
                                                                                    specified
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  Runs tests with updated typescript version and ES target
```

_See code: [src/commands/typescript/update.ts](https://github.com/salesforcecli/plugin-release-management/blob/v3.1.0/src/commands/typescript/update.ts)_

<!-- commandsstop -->
