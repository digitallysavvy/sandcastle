---
"@ai-hero/sandcastle": patch
---

Remove recursive chown from Docker and Podman sandbox startup. For Podman, use `--userns=keep-id:uid=N,gid=N` to align bind-mount and image ownership via namespace mapping instead. For Docker, rely on `--user` alone without post-start chown. Add `containerUid`/`containerGid` options to Podman provider.
