/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Confirmation - When on, Unwrap Folder runs immediately without asking. Unwrap Folder Deeply always confirms. */
  "skipConfirmation": boolean,
  /** Disposable Entries - Comma-separated names safe to delete from an otherwise-empty folder before trashing it (e.g. .DS_Store, Thumbs.db, .localized). */
  "disposableEntries": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `unwrap-folder` command */
  export type UnwrapFolder = ExtensionPreferences & {}
  /** Preferences accessible in the `unwrap-folder-deep` command */
  export type UnwrapFolderDeep = ExtensionPreferences & {}
  /** Preferences accessible in the `wrap-folder` command */
  export type WrapFolder = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `unwrap-folder` command */
  export type UnwrapFolder = {}
  /** Arguments passed to the `unwrap-folder-deep` command */
  export type UnwrapFolderDeep = {}
  /** Arguments passed to the `wrap-folder` command */
  export type WrapFolder = {}
}

