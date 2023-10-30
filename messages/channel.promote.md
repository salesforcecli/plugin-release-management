# description

promote a s3 channel

# summary

promote a s3 channel

# examples

- <%= config.bin %> <%= command.id %> --candidate latest-rc --target latest --platform win --platform mac

# flags.dryrun.summary

If true, only show what would happen

# flags.promote-from-channel.summary

the channel name that you want to promote

# flags.promote-to-channel.summary

the channel name that you are promoting to

# flags.cli.summary

the cli name to promote

# flags.platform.summary

the platform to promote

# flags.sha.summary

the short sha to promote

# flags.max-age.summary

cache control max-age in seconds

# flags.indexes.summary

append the promoted urls into the index files

# flags.xz.summary

also upload xz

# targets

comma-separated targets to promote (e.g.: linux-arm,win32-x64)

# flags.version.summary

the version of the candidate to be promoted, which must exist already in s3. Used to fetch the correct sha

# InvalidTag

the %s channel does not exist in Amazon

# CannotPromoteToSameChannel

Candidate and target channels cannot the same.

# DryRunMessage

Dry run results.
Promoting cli %s version %s commit %s to channel %s for platforms %s

# MissingDependencies

Missing required environment variables or utilities

# CouldNotDetermineShaAndVersion

Could not determine sha and version from provided parameters

# CouldNotLocateShaForVersion

Could locate sha for version "%s" in S3

# CouldNotLocateVersionForSha

Could locate version for sha "%s" in S3
