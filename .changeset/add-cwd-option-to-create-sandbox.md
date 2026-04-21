---
"@ai-hero/sandcastle": patch
---

Add `cwd` option to `createSandbox()`. When provided, it replaces `process.cwd()` as the host repo directory anchor for `.sandcastle/worktrees/`, `.sandcastle/.env`, and git operations. Relative paths resolve against `process.cwd()`; absolute paths pass through. Removes `_test.hostRepoDir` from `CreateSandboxOptions` — tests now use the public `cwd` option.
