---
"@ai-hero/sandcastle": patch
---

Add `cwd` option to `createWorktree()`. When provided, it replaces `process.cwd()` as the host repo directory anchor for `.sandcastle/worktrees/`, `.sandcastle/.env`, and git operations. Relative paths resolve against `process.cwd()`; absolute paths pass through. A new `CwdError` is raised when the path does not exist or is not a directory.
