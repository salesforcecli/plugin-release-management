# description

list repositories owned and supported by Salesforce CLI
For more information on the list of repositories, visit https://github.com/salesforcecli/status.

# examples

- <%= config.bin %> <%= command.id %> --columns=url --filter='Name=sfdx-core' --no-header | xargs open

- <%= config.bin %> <%= command.id %> --json | jq -r '.result[] | select(.name=="sfdx-core") | .packages[] | .url

# flags.columns.summary

Only show provided columns (comma-separated).

# flags.csv.summary

Output is csv format.

# flags.extended.summary

Show extra columns.

# flags.filter.summary

Filter property by partial string matching, ex: name=foo.

# flags.no-header.summary

Hide table header from output.

# flags.no-truncate.summary

Do not truncate output to fit screen.

# flags.output.summary

Output in a more machine friendly format.

# flags.sort.summary

Property to sort by (prepend '-' for descending).
