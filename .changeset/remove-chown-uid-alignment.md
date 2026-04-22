---
"@ai-hero/sandcastle": patch
---

Faster sandbox startup — remove the recursive `chown` that ran on every Docker and Podman container start. Add `containerUid`/`containerGid` options to the Podman provider for controlling in-container ownership.
