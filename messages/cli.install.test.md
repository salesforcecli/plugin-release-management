# description

install sf or sfdx

# examples

- <%= config.bin %> <%= command.id %> --cli sfdx --method installer

- <%= config.bin %> <%= command.id %> --cli sfdx --method npm

- <%= config.bin %> <%= command.id %> --cli sfdx --method tarball

- <%= config.bin %> <%= command.id %> --cli sf --method tarball

- <%= config.bin %> <%= command.id %> --cli sf --method tarball --channel stable-rc

# flags.cli.summary

the cli to install

# flags.method.summary

the installation method to use

# flags.channel.summary

the channel to install from

# flags.output-file.summary

the file to write the JSON results to (must be .json)
