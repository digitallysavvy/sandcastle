---
"@ai-hero/sandcastle": patch
---

Add AbortSignal support for cancelling runs and interactive sessions. Pass `signal` to `run()`, `interactive()`, `Sandbox.run()`, `Sandbox.interactive()`, or any Worktree equivalent. Aborting kills the in-flight agent subprocess; handles remain usable for subsequent calls. Lifecycle hooks (`host.onWorktreeReady`, `host.onSandboxReady`, `sandbox.onSandboxReady`) are also cancelled when the signal fires.
