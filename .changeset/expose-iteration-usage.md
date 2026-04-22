---
"@ai-hero/sandcastle": patch
---

Expose per-iteration token usage on `IterationResult` via a new `usage?: IterationUsage` field. Returns raw token counts (`inputTokens`, `cacheCreationInputTokens`, `cacheReadInputTokens`, `outputTokens`) for Claude Code runs. Non-Claude agent providers return `undefined`.
