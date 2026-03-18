import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTokens } from "./TokenResolver.js";

const makeDir = () => mkdtemp(join(tmpdir(), "token-resolver-"));

describe("resolveTokens", () => {
  it("reads tokens from repo root .env", async () => {
    const dir = await makeDir();
    await writeFile(
      join(dir, ".env"),
      "CLAUDE_CODE_OAUTH_TOKEN=root-oauth\nGH_TOKEN=root-gh\n",
    );

    const tokens = await resolveTokens(dir);
    expect(tokens.oauthToken).toBe("root-oauth");
    expect(tokens.ghToken).toBe("root-gh");
  });

  it("reads tokens from .sandcastle/.env", async () => {
    const dir = await makeDir();
    await mkdir(join(dir, ".sandcastle"));
    await writeFile(
      join(dir, ".sandcastle", ".env"),
      "CLAUDE_CODE_OAUTH_TOKEN=sc-oauth\nGH_TOKEN=sc-gh\n",
    );

    const tokens = await resolveTokens(dir);
    expect(tokens.oauthToken).toBe("sc-oauth");
    expect(tokens.ghToken).toBe("sc-gh");
  });

  it("falls back to process env vars", async () => {
    const dir = await makeDir();
    const origOauth = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
    const origGh = process.env["GH_TOKEN"];

    try {
      process.env["CLAUDE_CODE_OAUTH_TOKEN"] = "env-oauth";
      process.env["GH_TOKEN"] = "env-gh";

      const tokens = await resolveTokens(dir);
      expect(tokens.oauthToken).toBe("env-oauth");
      expect(tokens.ghToken).toBe("env-gh");
    } finally {
      if (origOauth === undefined) delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      else process.env["CLAUDE_CODE_OAUTH_TOKEN"] = origOauth;
      if (origGh === undefined) delete process.env["GH_TOKEN"];
      else process.env["GH_TOKEN"] = origGh;
    }
  });

  it("repo root .env takes precedence over .sandcastle/.env", async () => {
    const dir = await makeDir();
    await writeFile(
      join(dir, ".env"),
      "CLAUDE_CODE_OAUTH_TOKEN=root-oauth\nGH_TOKEN=root-gh\n",
    );
    await mkdir(join(dir, ".sandcastle"));
    await writeFile(
      join(dir, ".sandcastle", ".env"),
      "CLAUDE_CODE_OAUTH_TOKEN=sc-oauth\nGH_TOKEN=sc-gh\n",
    );

    const tokens = await resolveTokens(dir);
    expect(tokens.oauthToken).toBe("root-oauth");
    expect(tokens.ghToken).toBe("root-gh");
  });

  it(".sandcastle/.env takes precedence over process env", async () => {
    const dir = await makeDir();
    const origOauth = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
    const origGh = process.env["GH_TOKEN"];

    try {
      process.env["CLAUDE_CODE_OAUTH_TOKEN"] = "env-oauth";
      process.env["GH_TOKEN"] = "env-gh";

      await mkdir(join(dir, ".sandcastle"));
      await writeFile(
        join(dir, ".sandcastle", ".env"),
        "CLAUDE_CODE_OAUTH_TOKEN=sc-oauth\nGH_TOKEN=sc-gh\n",
      );

      const tokens = await resolveTokens(dir);
      expect(tokens.oauthToken).toBe("sc-oauth");
      expect(tokens.ghToken).toBe("sc-gh");
    } finally {
      if (origOauth === undefined) delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      else process.env["CLAUDE_CODE_OAUTH_TOKEN"] = origOauth;
      if (origGh === undefined) delete process.env["GH_TOKEN"];
      else process.env["GH_TOKEN"] = origGh;
    }
  });

  it("mixed sources — one token from root .env, other from .sandcastle/.env", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, ".env"), "CLAUDE_CODE_OAUTH_TOKEN=root-oauth\n");
    await mkdir(join(dir, ".sandcastle"));
    await writeFile(
      join(dir, ".sandcastle", ".env"),
      "GH_TOKEN=sc-gh\n",
    );

    const tokens = await resolveTokens(dir);
    expect(tokens.oauthToken).toBe("root-oauth");
    expect(tokens.ghToken).toBe("sc-gh");
  });

  it("errors when CLAUDE_CODE_OAUTH_TOKEN is missing everywhere", async () => {
    const dir = await makeDir();
    const origOauth = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
    const origGh = process.env["GH_TOKEN"];

    try {
      delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      process.env["GH_TOKEN"] = "env-gh";

      await expect(resolveTokens(dir)).rejects.toThrow(
        "CLAUDE_CODE_OAUTH_TOKEN not found",
      );
    } finally {
      if (origOauth === undefined) delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      else process.env["CLAUDE_CODE_OAUTH_TOKEN"] = origOauth;
      if (origGh === undefined) delete process.env["GH_TOKEN"];
      else process.env["GH_TOKEN"] = origGh;
    }
  });

  it("errors when GH_TOKEN is missing everywhere", async () => {
    const dir = await makeDir();
    const origOauth = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
    const origGh = process.env["GH_TOKEN"];

    try {
      process.env["CLAUDE_CODE_OAUTH_TOKEN"] = "env-oauth";
      delete process.env["GH_TOKEN"];

      await expect(resolveTokens(dir)).rejects.toThrow("GH_TOKEN not found");
    } finally {
      if (origOauth === undefined) delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      else process.env["CLAUDE_CODE_OAUTH_TOKEN"] = origOauth;
      if (origGh === undefined) delete process.env["GH_TOKEN"];
      else process.env["GH_TOKEN"] = origGh;
    }
  });

  it("ignores comments and blank lines in .env files", async () => {
    const dir = await makeDir();
    await writeFile(
      join(dir, ".env"),
      "# This is a comment\n\nCLAUDE_CODE_OAUTH_TOKEN=oauth-val\n\n# Another comment\nGH_TOKEN=gh-val\n",
    );

    const tokens = await resolveTokens(dir);
    expect(tokens.oauthToken).toBe("oauth-val");
    expect(tokens.ghToken).toBe("gh-val");
  });
});
