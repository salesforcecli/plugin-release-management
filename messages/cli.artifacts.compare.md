# summary

Look for breaking changes in artifacts (schemas and snapshots) from plugins. Must be run in CLI directory.

# examples

- <%= config.bin %> <%= command.id %>

# error.BreakingChanges

Breaking changes found in artifacts

# flags.plugin.summary

List of plugins to check for breaking changes.

# flags.previous.summary

Previous CLI version to compare against. Defaults to the last published version.

# flags.current.summary

Current CLI version to compare against. Defaults to the version on the CLI in the current directory.

# error.VersionNotFound

Version not found: %s.

# error.InvalidVersions

Current version %s must be newer than previous version %s.

# error.InvalidRepo

This command must be run from the root directory of @salesforce/cli or sfdx-cli.

# error.VersionNotPinned

Plugin %s is not pinned in package.json.
