# description

automatically merge one green, mergeable PR up to the specified maximum bump type

# flags.skip-ci.summary

add [skip ci] to the merge commit title

# flags.merge-method.summary

merge method to use

# examples

- <%= config.bin %> <%= command.id %> --max-version-bump patch

- <%= config.bin %> <%= command.id %> --max-version-bump minor

- <%= config.bin %> <%= command.id %> --max-version-bump major
