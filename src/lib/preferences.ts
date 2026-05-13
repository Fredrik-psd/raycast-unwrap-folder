import { getPreferenceValues } from "@raycast/api";

export type Preferences = {
  skipConfirmation: boolean;
  disposableEntries: Set<string>;
};

type RawPreferences = {
  skipConfirmation?: boolean;
  disposableEntries?: string;
};

const DEFAULT_DISPOSABLE_ENTRIES = [".DS_Store", ".localized", "Thumbs.db"];

export function getPreferences(): Preferences {
  const raw = getPreferenceValues<RawPreferences>();
  const disposable = parseDisposableList(raw.disposableEntries);

  return {
    skipConfirmation: raw.skipConfirmation ?? false,
    disposableEntries: disposable,
  };
}

function parseDisposableList(value: string | undefined): Set<string> {
  if (value === undefined || value.trim().length === 0) {
    return new Set(DEFAULT_DISPOSABLE_ENTRIES);
  }
  return new Set(
    value
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  );
}
