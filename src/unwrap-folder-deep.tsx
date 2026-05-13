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
import { lstat } from "node:fs/promises";
import { useEffect, useState } from "react";
import path from "node:path";
import { getPreferences } from "./lib/preferences";
import {
  formatCount,
  getSelectedFolderPaths,
  planBatchUnwrap,
  unwrapFolders,
} from "./lib/unwrap";

const DEFAULT_DEPTH = "3";

export default function Command() {
  const { pop } = useNavigation();
  const [depthInput, setDepthInput] = useState(DEFAULT_DEPTH);
  const [selectedFolders, setSelectedFolders] = useState<string[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const items = await getSelectedFinderItems();
        const folders = await getSelectedFolderPaths(
          items.map((item) => item.path),
        );
        setSelectedFolders(folders);
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

  const parsedDepth = Number.parseInt(depthInput, 10);
  const isValidDepth = Number.isFinite(parsedDepth) && parsedDepth >= 1;

  return (
    <Form
      isLoading={selectedFolders === undefined}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Unwrap Deeply"
            icon={Icon.ArrowsExpand}
            onSubmit={async () => {
              if (!isValidDepth || selectedFolders === undefined) {
                return;
              }
              await runDeepUnwrap(selectedFolders, parsedDepth);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="depth"
        title="Max Depth"
        placeholder="3"
        value={depthInput}
        onChange={setDepthInput}
        error={isValidDepth ? undefined : "Enter a positive whole number"}
      />
      <Form.Description
        title="Selected"
        text={
          selectedFolders === undefined
            ? "Reading selection…"
            : selectedFolders.length === 0
              ? "No folders selected"
              : selectedFolders
                  .map((folderPath) => path.basename(folderPath))
                  .join(", ")
        }
      />
      <Form.Description
        title="What this does"
        text={
          "Unwraps each selected folder, then unwraps the resulting folder " +
          "if it contains exactly one subfolder, up to the depth above. " +
          "Stops earlier if the chain ends before reaching the limit."
        }
      />
    </Form>
  );
}

async function runDeepUnwrap(folderPaths: string[], maxDepth: number) {
  try {
    const preferences = getPreferences();

    const toast = await showToast({
      style: Toast.Style.Animated,
      title:
        folderPaths.length === 1
          ? "Unwrapping deeply…"
          : `Unwrapping ${folderPaths.length} folders deeply…`,
    });

    let totalDeleted = 0;
    let totalMoved = 0;

    for (const folderPath of folderPaths) {
      const summary = await deepUnwrapOne(
        folderPath,
        maxDepth,
        preferences.disposableEntries,
        toast,
      );
      totalDeleted += summary.deletedFolderCount;
      totalMoved += summary.movedItemCount;
    }

    toast.style = Toast.Style.Success;
    toast.title = `Unwrapped ${formatCount(totalDeleted, "wrapper folder")}`;
    toast.message = `Moved ${formatCount(totalMoved, "item")}.`;

    await showHUD(toast.title);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't unwrap deeply",
      message,
    });
  }
}

async function deepUnwrapOne(
  folderPath: string,
  maxDepth: number,
  disposableEntries: Set<string>,
  toast: Toast,
): Promise<{ deletedFolderCount: number; movedItemCount: number }> {
  let current = folderPath;
  let deleted = 0;
  let moved = 0;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (!(await isDirectory(current))) {
      break;
    }

    const plans = await planBatchUnwrap([current], disposableEntries);
    const summary = await unwrapFolders(plans, disposableEntries, toast);

    deleted += summary.deletedFolderCount;
    moved += summary.movedItemCount;

    // Stop unless this iteration revealed exactly one folder we can keep unwrapping.
    if (plans[0].moves.length !== 1) {
      break;
    }

    const nextCandidate = plans[0].moves[0].destination;
    if (!(await isDirectory(nextCandidate))) {
      break;
    }

    current = nextCandidate;
  }

  return { deletedFolderCount: deleted, movedItemCount: moved };
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stats = await lstat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
