/**
 * Daytona isolated sandbox provider.
 *
 * Creates ephemeral Daytona sandboxes via `@daytona/sdk`.
 * Requires `@daytona/sdk` as a peer dependency.
 */

import {
  createIsolatedSandboxProvider,
  type ExecResult,
  type IsolatedBranchStrategy,
  type IsolatedSandboxHandle,
  type IsolatedSandboxProvider,
} from "../SandboxProvider.js";

import type {
  Daytona as DaytonaClient,
  DaytonaConfig,
  CreateSandboxFromImageParams,
  CreateSandboxFromSnapshotParams,
} from "@daytona/sdk";

/** Options for the Daytona sandbox provider. */
export interface DaytonaOptions {
  /**
   * Daytona API key for authentication.
   * Falls back to the `DAYTONA_API_KEY` environment variable if not provided.
   */
  readonly apiKey?: string;

  /**
   * Daytona API URL.
   * Falls back to the `DAYTONA_API_URL` environment variable if not provided.
   */
  readonly apiUrl?: string;

  /**
   * Target environment for sandboxes.
   * Falls back to the `DAYTONA_TARGET` environment variable if not provided.
   */
  readonly target?: string;

  /** Branch strategy for this provider. Defaults to `{ type: "merge-to-head" }`. */
  readonly branchStrategy?: IsolatedBranchStrategy;

  /**
   * Options passed through to the Daytona SDK when creating a sandbox.
   * Supports both image-based and snapshot-based creation.
   */
  readonly create?:
    | CreateSandboxFromImageParams
    | CreateSandboxFromSnapshotParams;
}

/**
 * Create a Daytona isolated sandbox provider.
 *
 * Sandboxes are ephemeral — each `create()` call spins up a new Daytona
 * sandbox and `close()` destroys it.
 *
 * @example
 * ```ts
 * import { daytona } from "@ai-hero/sandcastle/sandboxes/daytona";
 *
 * const provider = daytona({ apiKey: "dyt_my_key" });
 * ```
 */
export const daytona = (options?: DaytonaOptions): IsolatedSandboxProvider =>
  createIsolatedSandboxProvider({
    name: "daytona",
    branchStrategy: options?.branchStrategy,
    create: async (): Promise<IsolatedSandboxHandle> => {
      const { Daytona } =
        (await import("@daytona/sdk")) as typeof import("@daytona/sdk");

      const config: DaytonaConfig = {};
      if (options?.apiKey) config.apiKey = options.apiKey;
      if (options?.apiUrl) config.apiUrl = options.apiUrl;
      if (options?.target) config.target = options.target;

      const client: DaytonaClient = new Daytona(config);
      const sandbox = await client.create(options?.create as any);

      const workspacePath =
        (await sandbox.getWorkDir()) ??
        (await sandbox.getUserHomeDir()) ??
        "/home/daytona";

      return {
        workspacePath,

        exec: async (
          command: string,
          opts?: { cwd?: string },
        ): Promise<ExecResult> => {
          const response = await sandbox.process.executeCommand(
            command,
            opts?.cwd ?? workspacePath,
          );
          return {
            stdout: response.result,
            stderr: "",
            exitCode: response.exitCode,
          };
        },

        execStreaming: async (
          command: string,
          onLine: (line: string) => void,
          opts?: { cwd?: string },
        ): Promise<ExecResult> => {
          const response = await sandbox.process.executeCommand(
            command,
            opts?.cwd ?? workspacePath,
          );
          const lines = response.result.split("\n");
          for (const line of lines) {
            onLine(line);
          }
          return {
            stdout: response.result,
            stderr: "",
            exitCode: response.exitCode,
          };
        },

        copyIn: async (
          hostPath: string,
          sandboxPath: string,
        ): Promise<void> => {
          await sandbox.fs.uploadFile(hostPath, sandboxPath);
        },

        copyOut: async (
          sandboxPath: string,
          hostPath: string,
        ): Promise<void> => {
          await sandbox.fs.downloadFile(sandboxPath, hostPath);
        },

        close: async (): Promise<void> => {
          await client.delete(sandbox);
        },
      };
    },
  });
