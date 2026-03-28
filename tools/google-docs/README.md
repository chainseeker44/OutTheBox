# Google Docs & Sheets Tool

CLI for Google Docs and Sheets operations — read, write, create, and modify documents and spreadsheets.

## Setup

1. OAuth configured via `auth.js` → token stored in `token.json`
2. Auth'd for: `YOUR_GOOGLE_ACCOUNT@gmail.com`
3. Scopes: `documents`, `spreadsheets`, `drive.file`

## Usage

```bash
# Docs
node gdocs.js docs list                          # List recent docs
node gdocs.js docs create "Title"                # Create new doc
node gdocs.js docs read <docId>                  # Read doc content
node gdocs.js docs write <docId> "content"       # Append to doc
node gdocs.js docs replace <docId> "old" "new"   # Find & replace
node gdocs.js docs insert <docId> <idx> "text"   # Insert at position

# Sheets
node gdocs.js sheets list                        # List recent sheets
node gdocs.js sheets create "Title"              # Create new sheet
node gdocs.js sheets read <sheetId> [range]      # Read data (default: Sheet1)
node gdocs.js sheets write <id> <range> <json>   # Write 2D JSON array
node gdocs.js sheets append <id> <range> <json>  # Append rows
```

## Files

- `gdocs.js` — Main CLI tool
- `auth.js` — OAuth setup/refresh
- `config.json` — OAuth client config
- `token.json` — OAuth tokens (auto-refreshes)
- `format-neural*.js` — Project-specific doc formatters
- `setup-signal-sheet.js` — Signal tracking sheet setup

## Examples

```bash
# Read a doc
node gdocs.js docs read 1leYNSeY7kpiBBGofN55csnikFbbUh9-RMtt9AkwW6Kc

# Append to a doc
node gdocs.js docs write <docId> "\n\nNew section content..."

# Read Sheet1 A1:D10
node gdocs.js sheets read <sheetId> "Sheet1!A1:D10"

# Append rows
node gdocs.js sheets append <sheetId> "Sheet1" '[["A","B"],["C","D"]]'
```

## Notes

- Token auto-refreshes when expired
- All dates/times in user's timezone
- Drive API used for file listing (docs/sheets APIs don't have list)
