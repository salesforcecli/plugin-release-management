# description

publish npm package

# flags.dryrun.summary

If true, will not commit changes to repo or push any tags

# flags.sign.summary

If true, then the package will be signed and the signature will be uploaded to S3

# flags.npmtag.summary

tag to use when publishing to npm

# flags.npmaccess.summary

access level to use when publishing to npm

# flags.install.summary

run yarn install and build on repository

# flags.githubtag.summary

given a github tag, release the version specified in the package.json as is. Useful when you've already done a release and only need npm publish features

# flags.prerelease.summary

determine the next version as <version>-<prerelease>.0 if version is not manually set

# flags.verify.summary

verify npm registry has new version after publish and digital signature

# flags.trusted-publishing.summary

publish using npm Trusted Publishing (OIDC) instead of an auth token; requires running in a configured CI environment against the public npm registry with npm >= 11.5.1

# flags.pin-dependencies.summary

pin every production dependency to the version installed from yarn.lock before publishing

# flags.pin-dependencies.description

npm ignores yarn.lock and resolutions when a package is installed from the registry. This writes the exact version of every production package installed at the top of node_modules into "dependencies", so npm installs nearly the same tree as the CLI installers (packages yarn had to nest still resolve from their ranges). Libraries (no "oclif" property) and core plugins of @salesforce/cli are skipped because they have to dedupe with the packages installed next to them; a plugin that becomes core must publish a new release so the CLI doesn't depend on a pinned version. package.json is restored after publishing.

# pinned

Pinned %s dependencies of %s to their installed versions. %s packages are only installed nested and still resolve from their ranges.

# pinSkipped

Not pinning dependencies of %s because %s.

# InvalidNextVersion

%s already exists in the public npm registry

# MissingDependencies

Missing requred environment variables or utilities
