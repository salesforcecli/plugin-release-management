# description

consolidate dependabot PRs into a single PR

# maxVersionBump

the maximum version bump you want to be included

# dryrun

only show what would happen if you consolidated dependabot PRs

# baseBranch

name of the base branch for merging

# targetBranch

name of the target branch for merging

# noPR

do everything but create the PR

# ignore

ignore any PRs with titles that include this value

# owner

the organization that the repository belongs to. This defaults to the owner specified in the package.json

# repo

the repository you want to consolidate PRs on. This defaults to the repository specified in the package.json

# examples

- <%= config.bin %> <%= command.id %> --max-version-bump patch

- <%= config.bin %> <%= command.id %> --max-version-bump minor

- <%= config.bin %> <%= command.id %> --max-version-bump major
