import {
  Action,
  ActionPanel,
  Form,
  getSelectedFinderItems,
  Icon,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { useEffect, useState } from "react";
import { formatCount } from "./lib/unwrap";

type SelectedItem = {
  path: string;
  name: string;
};

export default function Command() {
  const { pop } = useNavigation();
  const [folderName, setFolderName] = useState("");
  const [selected, setSelected] = useState<SelectedItem[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const items = await getSelectedFinderItems();
        if (items.length === 0) {
          throw new Error("Select one or more items in Finder.");
        }
        setSelected(
          items.map((item) => ({
            path: item.path,
            name: path.basename(item.path),
          })),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
  }, []);

  if (error !== undefined) {
    return (
      <Form>
        <Form.Description title="Couldn't read selection" text={error} />
      </Form>
    );
  }

  const trimmedName = folderName.trim();
  const nameError = validateFolderName(trimmedName);

  return (
    <Form
      isLoading={selected === undefined}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Wrap into Folder"
            icon={Icon.NewFolder}
            onSubmit={async () => {
              if (selected === undefined || nameError !== undefined) {
                return;
              }
              await runWrap(selected, trimmedName);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="folderName"
        title="Folder Name"
        placeholder="New Folder"
        value={folderName}
        onChange={setFolderName}
        autoFocus
        error={nameError}
      />
      <Form.Description
        title="Selected"
        text={
          selected === undefined
            ? "Reading selection…"
            : selected.map((item) => item.name).join(", ")
        }
      />
      <Form.Description
        title="What this does"
        text={
          "Creates a new folder with the name above in the parent directory " +
          "of your selection, then moves every selected item into it."
        }
      />
    </Form>
  );
}

function validateFolderName(name: string): string | undefined {
  if (name.length === 0) {
    return "Enter a folder name";
  }
  if (name === "." || name === "..") {
    return "Pick a different name";
  }
  if (/[\\/:]/.test(name)) {
    return "Name can't contain / \\ or :";
  }
  return undefined;
}

async function runWrap(items: SelectedItem[], folderName: string) {
  try {
    // All selected items must share the same parent for the operation to
    // make sense ("wrap these into a folder *here*"). If they don't, we
    // wrap into the parent of the first item — but reject the case where
    // some selected items aren't siblings of others, which would lose
    // their location.
    const parents = new Set(items.map((item) => path.dirname(item.path)));
    if (parents.size > 1) {
      throw new Error(
        "Selected items are in different folders. Select items from one folder at a time.",
      );
    }
    const parentPath = [...parents][0];
    const targetFolderPath = path.join(parentPath, folderName);

    if (await pathExists(targetFolderPath)) {
      throw new Error(`"${folderName}" already exists in this folder.`);
    }

    // Block the case where one of the selected items has the same name
    // as the new folder — the rename would clash.
    if (items.some((item) => item.name === folderName)) {
      throw new Error(
        `One of the selected items is already named "${folderName}".`,
      );
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Wrapping ${formatCount(items.length, "item")}…`,
    });

    await mkdir(targetFolderPath, { recursive: false });

    for (const item of items) {
      const destination = path.join(targetFolderPath, item.name);
      await rename(item.path, destination);
    }

    toast.style = Toast.Style.Success;
    toast.title = `Wrapped ${formatCount(items.length, "item")}`;
    toast.message = `Created "${folderName}"`;

    await showHUD(toast.title);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't wrap items",
      message,
    });
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
