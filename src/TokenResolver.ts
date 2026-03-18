import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ResolvedTokens {
  readonly oauthToken: string;
  readonly ghToken: string;
}

const parseEnvFile = async (
  filePath: string,
): Promise<Record<string, string>> => {
  try {
    const content = await readFile(filePath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (value) vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
};

export const resolveTokens = async (
  repoDir: string,
): Promise<ResolvedTokens> => {
  // Precedence: repo root .env > .sandcastle/.env > process env
  const rootEnv = await parseEnvFile(join(repoDir, ".env"));
  const sandcastleEnv = await parseEnvFile(
    join(repoDir, ".sandcastle", ".env"),
  );

  const oauthToken =
    rootEnv["CLAUDE_CODE_OAUTH_TOKEN"] ??
    sandcastleEnv["CLAUDE_CODE_OAUTH_TOKEN"] ??
    process.env["CLAUDE_CODE_OAUTH_TOKEN"];

  const ghToken =
    rootEnv["GH_TOKEN"] ??
    sandcastleEnv["GH_TOKEN"] ??
    process.env["GH_TOKEN"];

  if (!oauthToken) {
    throw new Error(
      "CLAUDE_CODE_OAUTH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
    );
  }

  if (!ghToken) {
    throw new Error(
      "GH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
    );
  }

  return { oauthToken, ghToken };
};
