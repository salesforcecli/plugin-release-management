# description

builds a new release from a designated starting point and optionally creates PR in Github

# examples

- <%= config.bin %> <%= command.id %>

- <%= config.bin %> <%= command.id %> --patch

- <%= config.bin %> <%= command.id %> --start-from-npm-dist-tag latest-rc --patch

- <%= config.bin %> <%= command.id %> --start-from-github-ref 7.144.0

- <%= config.bin %> <%= command.id %> --start-from-github-ref main

- <%= config.bin %> <%= command.id %> --start-from-github-ref f476e8e

- <%= config.bin %> <%= command.id %> --start-from-github-ref main --prerelease beta

- <%= config.bin %> <%= command.id %> --build-only

- <%= config.bin %> <%= command.id %> --only @salesforce/plugin-source,@salesforce/plugin-info@1.2.3

# flags.start-from-npm-dist-tag.summary

the npm dist-tag to start the release from, examples: nightly, latest-rc

# flags.start-from-github-ref.summary

a Github ref to start the release from, examples: main, 7.144.0, f476e8e

# flags.release-channel.summary

the channel intended for this release, examples: nightly, latest-rc, latest, dev, beta, etc...

# flags.resolutions.summary

bump the versions of packages listed in the resolutions section

# flags.pinned-deps.summary

bump the versions of the packages listed in the pinnedDependencies section

# flags.jit.summary

bump the versions of the packages listed in the jitPlugins (just-in-time) section

# flags.label.summary

add one or more labels to the Github PR

# flags.only.summary

only bump the version of the packages passed in, uses latest if version is not provided

# flags.patch.summary

bump the release as a patch of an existing version, not a new minor version

# flags.build-only.summary

only build the release, do not git add/commit/push

# flags.empty.summary

create an empty release PR for pushing changes to later (version will still be bumped)

# flags.pr-base-branch.summary

base branch to create the PR against; if not specified, the build determines the branch for you
