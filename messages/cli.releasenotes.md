# description

pull all relevant information for writing release notes.
Requires the GH_TOKEN to be set in the environment.

# examples

- <%= config.bin %> <%= command.id %> --cli sf

- <%= config.bin %> <%= command.id %> --cli sfdx

- <%= config.bin %> <%= command.id %> --cli sf --since 1.0.0

- <%= config.bin %> <%= command.id %> --cli sfdx --since 7.19.0

- <%= config.bin %> <%= command.id %> --cli sf > changes.txt

- <%= config.bin %> <%= command.id %> --cli sf --markdown > changes.md

# flags.cli.summary

the cli to pull information for

# flags.since.summary

the version number of the previous release. Defaults to the latest-rc version on npm

# flags.markdown.summary

format the output in markdown
