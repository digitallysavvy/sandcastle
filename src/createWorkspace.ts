import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import type { CloseResult } from "./createSandbox.js";
import type {
  MergeToHeadBranchStrategy,
  NamedBranchStrategy,
} from "./SandboxProvider.js";
import * as WorkspaceManager from "./WorkspaceManager.js";
import { copyToWorkspace } from "./CopyToWorkspace.js";

/** Branch strategies valid for createWorkspace — head is excluded. */
export type WorkspaceBranchStrategy =
  | MergeToHeadBranchStrategy
  | NamedBranchStrategy;

export interface CreateWorkspaceOptions {
  /** Branch strategy — only 'branch' and 'merge-to-head' are allowed. */
  readonly branchStrategy: WorkspaceBranchStrategy;
  /** Paths relative to the host repo root to copy into the workspace at creation time. */
  readonly copyToWorkspace?: string[];
  /** @internal Test-only overrides. */
  readonly _test?: {
    readonly hostRepoDir?: string;
  };
}

export interface Workspace {
  /** The branch the workspace is on. */
  readonly branch: string;
  /** Host path to the workspace (worktree). */
  readonly workspacePath: string;
  /** Clean up the workspace. Preserves worktree if dirty. */
  close(): Promise<CloseResult>;
  /** Auto cleanup via `await using`. */
  [Symbol.asyncDispose](): Promise<void>;
}

/**
 * Creates a git worktree as an independent, first-class workspace.
 * Returns a Workspace handle with close() and [Symbol.asyncDispose]().
 *
 * Only accepts 'branch' and 'merge-to-head' strategies — 'head' is a
 * compile-time type error since head means no worktree.
 */
export const createWorkspace = async (
  options: CreateWorkspaceOptions,
): Promise<Workspace> => {
  const hostRepoDir = options._test?.hostRepoDir ?? process.cwd();

  const branch =
    options.branchStrategy.type === "branch"
      ? options.branchStrategy.branch
      : undefined;

  const worktreeInfo = await Effect.gen(function* () {
    yield* WorkspaceManager.pruneStale(hostRepoDir).pipe(
      Effect.catchAll(() => Effect.void),
    );
    const info = yield* WorkspaceManager.create(hostRepoDir, { branch });
    if (options.copyToWorkspace && options.copyToWorkspace.length > 0) {
      yield* copyToWorkspace(options.copyToWorkspace, hostRepoDir, info.path);
    }
    return info;
  }).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);

  let closed = false;

  const close = async (): Promise<CloseResult> => {
    if (closed) return { preservedWorkspacePath: undefined };
    closed = true;

    return Effect.gen(function* () {
      const isDirty = yield* WorkspaceManager.hasUncommittedChanges(
        worktreeInfo.path,
      ).pipe(Effect.catchAll(() => Effect.succeed(false)));

      if (isDirty) {
        return { preservedWorkspacePath: worktreeInfo.path } as CloseResult;
      }

      yield* WorkspaceManager.remove(worktreeInfo.path).pipe(
        Effect.catchAll(() => Effect.void),
      );

      return { preservedWorkspacePath: undefined } as CloseResult;
    }).pipe(Effect.runPromise);
  };

  return {
    branch: worktreeInfo.branch,
    workspacePath: worktreeInfo.path,
    close,
    async [Symbol.asyncDispose]() {
      await close();
    },
  };
};
