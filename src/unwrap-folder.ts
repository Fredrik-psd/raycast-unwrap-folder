import {
  Alert,
  confirmAlert,
  getSelectedFinderItems,
  showHUD,
  showToast,
  Toast,
  trash,
} from "@raycast/api";
import { randomUUID } from "node:crypto";
import { lstat, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

type PlannedMove = {
  source: string;
  destination: string;
};

type FolderUnwrapPlan = {
  folderPath: string;
  folderName: string;
  parentPath: string;
  temporaryFolderPath: string;
  moves: PlannedMove[];
};

const disposableEntries = new Set([".DS_Store"]);

export default async function command() {
  try {
    const selectedItems = await getSelectedFinderItems();
    const selectedFolderPaths = await getSelectedFolderPaths(
      selectedItems.map((item) => item.path),
    );
    const plans = await planBatchUnwrap(selectedFolderPaths);

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

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: getInProgressTitle(plans.length),
    });

    const summary = await unwrapFolders(plans);

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

async function getSelectedFolderPaths(selectedPaths: string[]) {
  if (selectedPaths.length === 0) {
    throw new Error("Select one or more folders in Finder.");
  }

  const folderPaths: string[] = [];

  for (const selectedPath of selectedPaths) {
    const selectedStats = await lstat(selectedPath);

    if (!selectedStats.isDirectory()) {
      throw new Error(
        `"${path.basename(selectedPath)}" is a file. Select folders only.`,
      );
    }

    folderPaths.push(selectedPath);
  }

  return [...new Set(folderPaths)];
}

async function planBatchUnwrap(
  folderPaths: string[],
): Promise<FolderUnwrapPlan[]> {
  assertNoNestedSelections(folderPaths);

  const plans: FolderUnwrapPlan[] = [];
  const selectedFolderPaths = new Set(folderPaths);
  const reservedDestinations = new Set<string>();
  const reservedTemporaryPaths = new Set(folderPaths);

  for (const folderPath of folderPaths) {
    const temporaryFolderPath = await createTemporaryFolderPath(
      folderPath,
      reservedTemporaryPaths,
    );
    const plan = await planFolderUnwrap(
      folderPath,
      temporaryFolderPath,
      selectedFolderPaths,
      reservedDestinations,
    );

    reservedTemporaryPaths.add(temporaryFolderPath);
    plans.push(plan);
  }

  return plans;
}

function assertNoNestedSelections(folderPaths: string[]) {
  const sortedPaths = [...folderPaths].sort();

  for (let index = 0; index < sortedPaths.length; index++) {
    const currentPath = sortedPaths[index];

    for (
      let compareIndex = index + 1;
      compareIndex < sortedPaths.length;
      compareIndex++
    ) {
      const comparedPath = sortedPaths[compareIndex];
      const relativePath = path.relative(currentPath, comparedPath);

      if (
        relativePath !== "" &&
        !relativePath.startsWith("..") &&
        !path.isAbsolute(relativePath)
      ) {
        throw new Error(
          `Cannot unwrap nested selections. "${path.basename(comparedPath)}" is inside "${path.basename(currentPath)}".`,
        );
      }
    }
  }
}

async function planFolderUnwrap(
  folderPath: string,
  temporaryFolderPath: string,
  selectedFolderPaths: Set<string>,
  reservedDestinations: Set<string>,
): Promise<FolderUnwrapPlan> {
  const parentPath = path.dirname(folderPath);
  const itemNames = await readdir(folderPath);
  const moves: PlannedMove[] = [];

  for (const itemName of itemNames) {
    if (disposableEntries.has(itemName)) {
      continue;
    }

    const destination = path.join(parentPath, itemName);

    if (reservedDestinations.has(destination)) {
      throw new Error(
        `Cannot unwrap because multiple selected folders would create "${itemName}" in "${parentPath}".`,
      );
    }

    if (
      !selectedFolderPaths.has(destination) &&
      (await pathExists(destination))
    ) {
      throw new Error(
        `Cannot unwrap because "${itemName}" already exists in the parent folder.`,
      );
    }

    moves.push({
      source: path.join(temporaryFolderPath, itemName),
      destination,
    });
    reservedDestinations.add(destination);
  }

  return {
    folderPath,
    folderName: path.basename(folderPath),
    parentPath,
    temporaryFolderPath,
    moves,
  };
}

async function unwrapFolders(plans: FolderUnwrapPlan[]) {
  let movedItemCount = 0;

  for (const plan of plans) {
    await rename(plan.folderPath, plan.temporaryFolderPath);
  }

  for (const plan of plans) {
    for (const move of plan.moves) {
      await rename(move.source, move.destination);
      movedItemCount += 1;
    }

    await deleteFolderIfEmpty(plan.temporaryFolderPath);
  }

  return {
    deletedFolderCount: plans.length,
    movedItemCount,
  };
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
    ? "Unwrapping folder..."
    : `Unwrapping ${folderCount} folders...`;
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

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

async function pathExists(targetPath: string) {
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

async function deleteFolderIfEmpty(folderPath: string) {
  await deleteDisposableEntries(folderPath);

  const remainingEntries = await readdir(folderPath);

  if (remainingEntries.length > 0) {
    throw new Error(
      `Stopped before moving "${path.basename(folderPath)}" to Trash because the folder is not empty.`,
    );
  }

  await trash(folderPath);
}

async function deleteDisposableEntries(folderPath: string) {
  for (const entryName of disposableEntries) {
    const entryPath = path.join(folderPath, entryName);

    try {
      await rm(entryPath, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function createTemporaryFolderPath(
  folderPath: string,
  reservedPaths: Set<string>,
) {
  const parentPath = path.dirname(folderPath);
  const folderName = path.basename(folderPath);

  while (true) {
    const candidatePath = path.join(
      parentPath,
      `.${folderName}.unwrap-folder-temp-${randomUUID()}`,
    );

    if (reservedPaths.has(candidatePath)) {
      continue;
    }

    if (await pathExists(candidatePath)) {
      continue;
    }

    return candidatePath;
  }
}
