# Unwrap Folder

A Raycast extension that unwraps one or more selected Finder folders — moves everything inside each folder up one level, then moves the now-empty wrapper folder to the Trash.

## What it does

When you select one or more folders in Finder and run **Unwrap Folder**, the command:

1. Moves everything inside each selected folder up one level.
2. Moves each selected folder to the Trash only after verifying it is empty.

The command stops before moving anything if:

- a selected item is a file rather than a folder,
- one selected folder is nested inside another selected folder,
- the unwrap would create a name conflict in the parent directory.

It also handles the case where a folder inside the selected folder has the same name as the selected folder, by temporarily renaming the wrapper folder before moving its contents out.

## Usage

Select one or more folders in Finder, then run **Unwrap Folder** from Raycast.
