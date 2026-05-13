import {
  Alert,
  confirmAlert,
  getSelectedFinderItems,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { getPreferences } from "./lib/preferences";
import {
  formatCount,
  getSelectedFolderPaths,
  planBatchUnwrap,
  unwrapFolders,
  type FolderUnwrapPlan,
} from "./lib/unwrap";

export default async function command() {
  try {
    const preferences = getPreferences();

    const selectedItems = await getSelectedFinderItems();
    const selectedFolderPaths = await getSelectedFolderPaths(
      selectedItems.map((item) => item.path),
    );
    const plans = await planBatchUnwrap(
      selectedFolderPaths,
      preferences.disposableEntries,
    );

    if (!preferences.skipConfirmation) {
      const confirmed = await confirmAlert({
        title: getConfirmationTitle(plans),
        message: getConfirmationMessage(plans),
        primaryAction: {
          title: getPrimaryActionTitle(plans.length),
          style: Alert.ActionStyle.Destructive,
        },
        dismissAction: {
          title: "Cancel",
        },
      });

      if (!confirmed) {
        return;
      }
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: getInProgressTitle(plans.length),
    });

    const summary = await unwrapFolders(
      plans,
      preferences.disposableEntries,
      toast,
    );

    toast.style = Toast.Style.Success;
    toast.title = getSuccessTitle(summary.deletedFolderCount);
    toast.message = getSuccessMessage(
      summary.deletedFolderCount,
      summary.movedItemCount,
    );

    await showHUD(toast.title);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't unwrap folder",
      message,
    });
  }
}

function getConfirmationTitle(plans: FolderUnwrapPlan[]) {
  if (plans.length === 1) {
    return `Unwrap "${plans[0].folderName}"?`;
  }

  return `Unwrap ${formatCount(plans.length, "folder")}?`;
}

function getConfirmationMessage(plans: FolderUnwrapPlan[]) {
  if (plans.length === 1) {
    const plan = plans[0];

    if (plan.moves.length === 0) {
      return `"${plan.folderName}" is empty and will be moved to Trash after confirming it is empty.`;
    }

    return `This will move ${formatCount(plan.moves.length, "item")} into "${plan.parentPath}" and move "${plan.folderName}" to Trash after confirming it is empty.`;
  }

  const totalMoves = plans.reduce((sum, plan) => sum + plan.moves.length, 0);
  return `This will move ${formatCount(totalMoves, "item")} out of ${formatCount(plans.length, "selected folder")} and move each folder to Trash only after confirming it is empty.`;
}

function getPrimaryActionTitle(folderCount: number) {
  return folderCount === 1 ? "Unwrap Folder" : "Unwrap Folders";
}

function getInProgressTitle(folderCount: number) {
  return folderCount === 1
    ? "Unwrapping folder…"
    : `Unwrapping ${folderCount} folders…`;
}

function getSuccessTitle(folderCount: number) {
  return folderCount === 1
    ? "Unwrapped folder"
    : `Unwrapped ${folderCount} folders`;
}

function getSuccessMessage(folderCount: number, movedItemCount: number) {
  if (movedItemCount === 0) {
    return folderCount === 1
      ? "Moved the empty folder to Trash."
      : "Moved the empty folders to Trash.";
  }

  return `Moved ${formatCount(movedItemCount, "item")} and moved ${formatCount(folderCount, "folder")} to Trash.`;
}
