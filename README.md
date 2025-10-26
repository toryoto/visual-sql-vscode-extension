# Visual SQL

View and edit SQL files in a table format directly in VS Code.

## Features

- View INSERT, UPDATE, and SELECT statements as tables
- Edit cells directly by clicking them
- Add or remove rows and columns
- Auto-saves changes back to your SQL file

## Usage

1. Open a .sql file
2. Find the "Visual SQL" panel in the sidebar
3. Edit your data in the table

## Supported SQL

- INSERT INTO - read/write
- UPDATE - read/write
- SELECT - read-only

## Screenshot

![Feature Screenshot](docs/image.png)

## Requirements

- VS Code 1.105.0 or higher

## Known Issues

Report bugs on GitHub

## Release Notes

### 0.0.2

- Added support for Boolean, Null, and Number data types
- Fixed table editing issue where content gets rewritten to a single line
- Better performance (debounced updates)
- Added input validation

### 0.0.1

- Initial release

## License

MIT