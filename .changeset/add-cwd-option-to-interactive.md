---
"@ai-hero/sandcastle": patch
---

Add `cwd` option to `interactive()`. When provided, it replaces `process.cwd()` as the host repo directory for worktree placement, env file resolution, and git operations. Relative paths resolve against `process.cwd()`; absolute paths pass through. Omitting `cwd` preserves existing behavior.
