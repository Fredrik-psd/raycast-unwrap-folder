# Unwrap Folder Changelog

## [Initial Version] - {PR_MERGE_DATE}

### Commands
- **Unwrap Folder** moves the contents of each selected Finder folder up one level and trashes the empty wrapper folder. Supports unwrapping multiple folders in a single run, with safety checks against name conflicts, files, and nested selections.
- **Unwrap Folder Deeply** repeats Unwrap up to a chosen depth — useful for archives extracted with multiple nested wrapper folders.
- **Wrap into Folder** moves the selected Finder items into a new folder you name.

### Quality of life
- Optional skip-confirmation preference for the basic Unwrap Folder command.
- Configurable list of disposable entries (`.DS_Store`, `.localized`, `Thumbs.db` by default).
- Progress indicator in the toast for unwraps of 100+ items.
