# description

list repositories owned and supported by Salesforce CLI
For more information on the list of repositories, visit https://github.com/salesforcecli/status.

# examples

- <%= config.bin %> <%= command.id %> --columns=url --filter='Name=sfdx-core' --no-header | xargs open

- <%= config.bin %> <%= command.id %> --json | jq -r '.result[] | select(.name=="sfdx-core") | .packages[] | .url
