---
"@ai-hero/sandcastle": patch
---

Fix Windows paths breaking Docker/Podman volume mounts. Backslashes in host paths and Windows-style sandbox paths are now normalized before reaching the container runtime.
