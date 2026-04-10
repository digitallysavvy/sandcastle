/**
 * Sync-out: extract changes from an isolated sandbox back to the host.
 *
 * Two-phase approach:
 * 1. Save phase: eagerly save all artifacts (patches, diff, untracked files)
 *    to `.sandcastle/patches/<timestamp>/` before attempting to apply.
 * 2. Apply phase: apply from the saved directory.
 *    - On success: clean up the patch directory.
 *    - On failure: preserve the patch directory and print recovery commands.
 *
 * Three-prong extraction within each phase:
 * 1. Committed changes: `git format-patch` + `git am --3way`
 * 2. Uncommitted changes (staged + unstaged): `git diff HEAD` + `git apply`
 * 3. Untracked files: `git ls-files --others` + `copyOut` each file
 */

import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { IsolatedSandboxHandle } from "./SandboxProvider.js";
import { buildRecoveryMessage, type FailedStep } from "./RecoveryMessage.js";
import { execHost, execOk } from "./sandboxExec.js";

/**
 * Check if a patch file is empty or header-only.
 * Merge commits produce patches with headers but no diff content.
 * A patch is considered empty if it has no lines starting with "diff --git".
 */
const isEmptyPatch = async (patchPath: string): Promise<boolean> => {
  const info = await stat(patchPath);
  if (info.size === 0) return true;

  const content = await readFile(patchPath, "utf-8");
  return !content.includes("diff --git");
};

/**
 * Generate a YYYYMMDD-HHMMSS timestamp directory name.
 * Appends a counter suffix (-1, -2, ...) if the directory already exists.
 */
const createPatchDir = async (hostRepoDir: string): Promise<string> => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const patchesRoot = join(hostRepoDir, ".sandcastle", "patches");
  await mkdir(patchesRoot, { recursive: true });

  let dirName = base;
  let counter = 0;
  while (existsSync(join(patchesRoot, dirName))) {
    counter++;
    dirName = `${base}-${counter}`;
  }

  const patchDir = join(patchesRoot, dirName);
  await mkdir(patchDir, { recursive: true });
  return patchDir;
};

/**
 * Sync changes from an isolated sandbox back to the host repo.
 *
 * Two-phase extraction with artifact persistence:
 * 1. Save all artifacts to `.sandcastle/patches/<timestamp>/`
 * 2. Apply from saved directory; on failure, preserve artifacts and print recovery
 */
export const syncOut = async (
  hostRepoDir: string,
  handle: IsolatedSandboxHandle,
): Promise<void> => {
  const workspacePath = handle.workspacePath;

  const hostHead = (await execHost("git rev-parse HEAD", hostRepoDir)).trim();
  const sandboxHead = (
    await execOk(handle, "git rev-parse HEAD", { cwd: workspacePath })
  ).stdout.trim();

  const hasCommits = hostHead !== sandboxHead;

  // Check for uncommitted changes
  const diffResult = await handle.exec("git diff HEAD", { cwd: workspacePath });
  const hasDiff =
    diffResult.exitCode === 0 && diffResult.stdout.trim().length > 0;

  // Check for untracked files
  const lsFilesResult = await handle.exec(
    "git ls-files --others --exclude-standard",
    { cwd: workspacePath },
  );
  const hasUntracked =
    lsFilesResult.exitCode === 0 && lsFilesResult.stdout.trim().length > 0;

  const untrackedFiles = hasUntracked
    ? lsFilesResult.stdout
        .trim()
        .split("\n")
        .filter((f) => f.length > 0)
    : [];

  // Nothing to sync
  if (!hasCommits && !hasDiff && !hasUntracked) {
    return;
  }

  // --- Phase 1: Save all artifacts ---
  const patchDir = await createPatchDir(hostRepoDir);
  const relativePatchDir = join(".sandcastle", "patches", basename(patchDir));

  const nonEmptyPatches: string[] = [];

  // Save committed patches
  if (hasCommits) {
    const mkTempResult = await execOk(
      handle,
      "mktemp -d -t sandcastle-patches-XXXXXX",
    );
    const sandboxPatchDir = mkTempResult.stdout.trim();

    try {
      await execOk(
        handle,
        `git format-patch "${hostHead}..HEAD" -o "${sandboxPatchDir}"`,
        { cwd: workspacePath },
      );

      const lsResult = await execOk(handle, `ls -1 "${sandboxPatchDir}"`);
      const patchNames = lsResult.stdout
        .trim()
        .split("\n")
        .filter((name) => name.length > 0);

      for (const patchName of patchNames) {
        const sandboxPatchPath = `${sandboxPatchDir}/${patchName}`;
        const hostPatchPath = join(patchDir, patchName);
        await handle.copyOut(sandboxPatchPath, hostPatchPath);

        if (!(await isEmptyPatch(hostPatchPath))) {
          nonEmptyPatches.push(hostPatchPath);
        }
      }
    } finally {
      await handle.exec(`rm -rf "${sandboxPatchDir}"`);
    }
  }

  // Save uncommitted diff
  if (hasDiff) {
    const diffPath = join(patchDir, "changes.patch");
    await writeFile(diffPath, diffResult.stdout);
  }

  // Save untracked files
  if (hasUntracked) {
    const untrackedDir = join(patchDir, "untracked");
    for (const relPath of untrackedFiles) {
      const sandboxFilePath = `${workspacePath}/${relPath}`;
      const hostFilePath = join(untrackedDir, relPath);
      await mkdir(dirname(hostFilePath), { recursive: true });
      await handle.copyOut(sandboxFilePath, hostFilePath);
    }
  }

  // --- Phase 2: Apply from saved directory ---
  let failedStep: FailedStep | undefined;

  // Apply committed patches
  if (nonEmptyPatches.length > 0) {
    try {
      await execHost("git am --abort", hostRepoDir).catch(() => {});
      const patchArgs = nonEmptyPatches.map((p) => `"${p}"`).join(" ");
      await execHost(`git am --3way ${patchArgs}`, hostRepoDir);
    } catch {
      failedStep = "commits";
    }
  }

  // Apply uncommitted diff
  if (!failedStep && hasDiff) {
    const diffPath = join(patchDir, "changes.patch");
    try {
      await execHost(`git apply "${diffPath}"`, hostRepoDir);
    } catch {
      failedStep = "diff";
    }
  }

  // Copy untracked files
  if (!failedStep && hasUntracked) {
    try {
      const untrackedDir = join(patchDir, "untracked");
      for (const relPath of untrackedFiles) {
        const srcPath = join(untrackedDir, relPath);
        const destPath = join(hostRepoDir, relPath);
        await mkdir(dirname(destPath), { recursive: true });
        const content = await readFile(srcPath);
        await writeFile(destPath, content);
      }
    } catch {
      failedStep = "untracked";
    }
  }

  // --- Cleanup or preserve ---
  if (failedStep) {
    const msg = buildRecoveryMessage({
      patchDir: relativePatchDir,
      failedStep,
      hasCommits: nonEmptyPatches.length > 0,
      hasDiff,
      hasUntracked,
    });
    console.error(`\n${msg}`);
  } else {
    await rm(patchDir, { recursive: true, force: true });
    // Clean up empty parent dirs
    const patchesRoot = join(hostRepoDir, ".sandcastle", "patches");
    try {
      const remaining = await readdir(patchesRoot);
      if (remaining.length === 0) {
        await rm(join(hostRepoDir, ".sandcastle"), {
          recursive: true,
          force: true,
        });
      }
    } catch {
      // ignore
    }
  }
};
