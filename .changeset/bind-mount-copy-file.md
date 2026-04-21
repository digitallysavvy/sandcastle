---
"@ai-hero/sandcastle": patch
---

Add `copyFileIn` and `copyFileOut` methods to `BindMountSandboxHandle`. Docker provider uses `docker cp`, Podman provider uses `podman cp`, and a new `testBindMount()` provider uses plain filesystem copy. This is the shared primitive that session capture/resume will build on.
