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

# InvalidNextVersion

%s already exists in the public npm registry

# MissingDependencies

Missing requred environment variables or utilities
