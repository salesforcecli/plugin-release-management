# description

inspect the CLI version across all install paths

# flags.dependencies.summary

glob pattern of dependencies you want to see the version of

# flags.salesforce.summary

show versions of salesforce owned dependencies

# flags.channels.summary

the channel you want to inspect (for achives, latest and latest-rc are translated to stable and stable-rc. And vice-versa for npm)

# flags.locations.summary

the location you want to inspect

# flags.cli.summary

the CLI you want to inspect

# examples

- <%= config.bin %> <%= command.id %> -l archive -c stable

- <%= config.bin %> <%= command.id %> -l archive -c stable-rc

- <%= config.bin %> <%= command.id %> -l archive npm -c stable

- <%= config.bin %> <%= command.id %> -l archive npm -c latest

- <%= config.bin %> <%= command.id %> -l archive npm -c latest latest-rc

- <%= config.bin %> <%= command.id %> -l archive npm -c stable stable-rc

- <%= config.bin %> <%= command.id %> -l npm -c latest --salesforce

- <%= config.bin %> <%= command.id %> -l npm -c latest -d @salesforce/core

- <%= config.bin %> <%= command.id %> -l npm -c latest -d @salesforce/\*\*/ salesforce-alm

- <%= config.bin %> <%= command.id %> -l npm -c latest -d chalk -s
