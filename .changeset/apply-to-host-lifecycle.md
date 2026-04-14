---
"@ai-hero/sandcastle": patch
---

Add `applyToHost` lifecycle callback to `SandboxInfo` so isolated providers can sync changes to the host worktree before host-side git operations. Fix `baseHead` recording to use the host worktree instead of the sandbox, ensuring correct commit collection after `syncOut` creates new SHAs via `format-patch`/`am`.
