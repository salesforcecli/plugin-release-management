# plugin-release-management

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

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

- [`sfdx circleci [-t plugin|library|orb] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circleci--t-pluginlibraryorb---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx circleci:envvar:update -e <string> [-s <string>] [--dryrun] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-circlecienvvarupdate--e-string--s-string---dryrun---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmlernarelease--d--s-array--t-string--a-string---install---githubrelease---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-npmpackagerelease--d--s--t-string--a-string---install---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx`](#sfdx-)
- [`sfdx trust:fingerprint -p <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-trustfingerprint--p-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx trust:sign -s <string> -p <string> -k <string> [-t <string> | --tarpath <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-trustsign--s-string--p-string--k-string--t-string----tarpath-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx trust:upload -f <string> -b <string> [-k <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-trustupload--f-string--b-string--k-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

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

_See code: [src/commands/circleci/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/circleci/index.ts)_

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

_See code: [src/commands/circleci/envvar/update.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/circleci/envvar/update.ts)_

## `sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

publish npm packages from a lerna repository

```
USAGE
  $ sfdx npm:lerna:release [-d] [-s <array>] [-t <string>] [-a <string>] [--install] [--githubrelease] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --npmaccess=npmaccess                                                         [default: public] access level to
                                                                                    use when publishing to npm

  -d, --dryrun                                                                      if true, will not commit changes to
                                                                                    repo or push any tags

  -s, --sign=sign                                                                   list of packages to be signed

  -t, --npmtag=npmtag                                                               [default: latest] tag to use when
                                                                                    publishing to npm

  --githubrelease                                                                   create release in github based on
                                                                                    the package changes

  --[no-]install                                                                    run yarn install and build on
                                                                                    repository

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/npm/lerna/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/npm/lerna/release.ts)_

## `sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

publish npm package

```
USAGE
  $ sfdx npm:package:release [-d] [-s] [-t <string>] [-a <string>] [--install] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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
```

_See code: [src/commands/npm/package/release.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/npm/package/release.ts)_

## `sfdx`

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

_See code: [src/commands/repositories/index.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/repositories/index.ts)_

## `sfdx trust:fingerprint -p <string> [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

get the SHA1 fingerprint for the provided url

```
USAGE
  $ sfdx trust:fingerprint -p <string> [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --publickeyurl=publickeyurl                                                   (required) the url where the public
                                                                                    key/certificate will be hosted.

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/trust/fingerprint.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/trust/fingerprint.ts)_

## `sfdx trust:sign -s <string> -p <string> -k <string> [-t <string> | --tarpath <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

pack an npm package and produce a tgz file along with a corresponding digital signature

```
USAGE
  $ sfdx trust:sign -s <string> -p <string> -k <string> [-t <string> | --tarpath <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -k, --privatekeypath=privatekeypath
      (required) the local file path for the private key.

  -p, --publickeyurl=publickeyurl
      (required) the url where the public key/certificate will be hosted.

  -s, --signatureurl=signatureurl
      (required) the url location where the signature will be hosted minus the name of the actual signature file.

  -t, --target=target
      the package path you want to target for signing. Helpful for signing individual packages within a multipackage
      project (e.g. lerna). Defaults to the current working directory.

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --tarpath=tarpath
      specify the package tgz path to sign instead of generating one from the target package
```

_See code: [src/commands/trust/sign.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/trust/sign.ts)_

## `sfdx trust:upload -f <string> -b <string> [-k <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

upload signature to S3. Requires AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID to be set in the environment

```
USAGE
  $ sfdx trust:upload -f <string> -b <string> [-k <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --bucket=bucket                                                               (required) name of S3 bucket

  -f, --signature=signature                                                         (required) path to .sig file you
                                                                                    want to upload to S3

  -k, --keyprefix=keyprefix                                                         prefix to add to S3 key

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/trust/upload.ts](https://github.com/salesforcecli/plugin-release-management/blob/v1.0.0/src/commands/trust/upload.ts)_

<!-- commandsstop -->
