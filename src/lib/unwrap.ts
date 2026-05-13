import { trash, Toast } from "@raycast/api";
import { randomUUID } from "node:crypto";
import { lstat, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

export type PlannedMove = {
  source: string;
  destination: string;
};

export type FolderUnwrapPlan = {
  folderPath: string;
  folderName: string;
  parentPath: string;
  temporaryFolderPath: string;
  moves: PlannedMove[];
};

export type UnwrapSummary = {
  deletedFolderCount: number;
  movedItemCount: number;
};

export async function getSelectedFolderPaths(
  selectedPaths: string[],
): Promise<string[]> {
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

export async function planBatchUnwrap(
  folderPaths: string[],
  disposableEntries: Set<string>,
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
      disposableEntries,
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
  disposableEntries: Set<string>,
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

// Execute the planned unwrap, updating the toast with progress every PROGRESS_EVERY_N_ITEMS.
export async function unwrapFolders(
  plans: FolderUnwrapPlan[],
  disposableEntries: Set<string>,
  toast?: Toast,
): Promise<UnwrapSummary> {
  const totalItems = plans.reduce((sum, plan) => sum + plan.moves.length, 0);
  let movedItemCount = 0;

  for (const plan of plans) {
    await rename(plan.folderPath, plan.temporaryFolderPath);
  }

  const PROGRESS_EVERY_N_ITEMS = 50;
  let nextProgressUpdate = PROGRESS_EVERY_N_ITEMS;

  for (const plan of plans) {
    for (const move of plan.moves) {
      await rename(move.source, move.destination);
      movedItemCount += 1;

      if (toast && totalItems >= 100 && movedItemCount >= nextProgressUpdate) {
        toast.title = `Unwrapping… ${movedItemCount}/${totalItems}`;
        nextProgressUpdate += PROGRESS_EVERY_N_ITEMS;
      }
    }

    await deleteFolderIfEmpty(plan.temporaryFolderPath, disposableEntries);
  }

  return {
    deletedFolderCount: plans.length,
    movedItemCount,
  };
}

async function deleteFolderIfEmpty(
  folderPath: string,
  disposableEntries: Set<string>,
) {
  await deleteDisposableEntries(folderPath, disposableEntries);

  const remainingEntries = await readdir(folderPath);

  if (remainingEntries.length > 0) {
    throw new Error(
      `Stopped before moving "${path.basename(folderPath)}" to Trash because the folder is not empty.`,
    );
  }

  await trash(folderPath);
}

async function deleteDisposableEntries(
  folderPath: string,
  disposableEntries: Set<string>,
) {
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

export function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// Find the single folder that's the "wrapper" of a folder, or undefined
// if the folder doesn't contain exactly one subfolder (and no other items
// except disposables).
export async function findSingleSubfolder(
  folderPath: string,
  disposableEntries: Set<string>,
): Promise<string | undefined> {
  const entries = await readdir(folderPath);
  const meaningful = entries.filter((name) => !disposableEntries.has(name));

  if (meaningful.length !== 1) {
    return undefined;
  }

  const child = path.join(folderPath, meaningful[0]);
  const childStats = await lstat(child);
  if (!childStats.isDirectory()) {
    return undefined;
  }

  return child;
}
