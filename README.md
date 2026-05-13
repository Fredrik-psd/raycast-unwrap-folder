# Unwrap Folder

A Raycast extension for flattening and grouping Finder folders.

## Commands

- **Unwrap Folder** — moves everything inside each selected Finder folder up one level, then trashes the empty wrapper folder.
- **Unwrap Folder Deeply** — repeats Unwrap up to N levels for archives that come with multiple nested wrapper folders.
- **Wrap into Folder** — moves the selected Finder items into a new folder you name.

## Unwrap Folder

Select one or more folders in Finder and run **Unwrap Folder**. By default a confirmation dialog appears; disable it in the extension's preferences if you use this often.

Safety checks:
- Stops before moving anything if a selected item is a file rather than a folder.
- Stops if one selected folder is nested inside another selected folder.
- Stops if the unwrap would create a name conflict in the parent directory.
- Handles the case where a folder inside the selected folder has the same name as the selected folder.

Progress is reported in the toast for very large unwraps.

## Unwrap Folder Deeply

Sometimes a downloaded archive nests its contents in two or three wrapper folders. Run **Unwrap Folder Deeply** to repeat Unwrap up to a chosen depth, stopping early once the chain ends (i.e. once a wrapper has more than one item or no folder to unwrap).

## Wrap into Folder

Select one or more items in Finder, run **Wrap into Folder**, and type a name. The extension creates the new folder next to the selection and moves every selected item into it. All selected items must be in the same parent folder.

## Preferences

- **Skip Confirmation** — when on, **Unwrap Folder** runs immediately without asking.
- **Disposable Entries** — comma-separated list of names safe to delete from an otherwise-empty wrapper folder before trashing it. Defaults to `.DS_Store, .localized, Thumbs.db`.
