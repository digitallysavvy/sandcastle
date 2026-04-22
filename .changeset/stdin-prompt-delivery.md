---
"@ai-hero/sandcastle": patch
---

Fix runs failing when prompts exceed 128 KB on Linux. Prompts are now delivered via stdin instead of command-line arguments, avoiding the `execve(2)` argument size limit.
