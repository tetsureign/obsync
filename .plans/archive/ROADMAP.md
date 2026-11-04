# obsync — Product Roadmap

> Historical architecture decisions are archived in [`.plans/archive/`](file:///home/nntthu/Development/obsync/.plans/archive/README.md) and codified in [ARCHITECTURE.md](file:///home/nntthu/Development/obsync/ARCHITECTURE.md).  
> This file tracks open product features and post-MVP enhancements.

---

## Active Track: Rust Daemon Migration

The TypeScript/NestJS daemon is being replaced by a lightweight, single-binary Rust daemon (`loco.rs` / Axum).
- **Execution Tracking**: [GitHub Milestone 1: Rust Daemon Migration](https://github.com/tetsureign/obsync/milestone/1)
- **Technical Specification**: [daemon-rust-migration.md](file:///home/nntthu/Development/obsync/.plans/daemon-rust-migration.md)

---

## Product Enhancements (Near Term)

### 1. CLI Daemon Probe Refinement
- Authenticated `GET /health` probe so an alive-but-unresponsive daemon is accurately detected.
- Clear error output including resolved lockfile path and platform service hints (`systemctl --user start obsyncd`, `launchctl kickstart ...`).

### 2. `--batch` / `--no-interactive` Flag
- Clean non-TTY output mode for CLI commands to facilitate scripting, git hooks, and CI workflows.

### 3. Vault Registration: Obsidian Ignore Nudge
Extend `obsync vault add` validation to advise users on common conflict-causing Obsidian files:
- Warn if `.gitignore` is missing workspace ignores (`.obsidian/workspace.json`, `.obsidian/workspace-mobile.json`, `.trash/`).
- Warn if `workspace.json` is already tracked in Git history (requiring `git rm --cached`).
- Advisory only: `add` inspects and advises without mutating user repos.

### 4. Quickstart Container Demo
- Minimal `docker-compose.yml` evaluating the daemon locally without host dependencies (see [remote-daemon-selfhosting.md](file:///home/nntthu/Development/obsync/.plans/remote-daemon-selfhosting.md)).

---

## Post-MVP Backlog

| Feature | Description | Notes |
|---|---|---|
| **`WatcherModule`** | Filesystem watcher (`notify`) maintaining vault `is_dirty` flag | Reserved in DB schema |
| **`SchedulerModule`** | Periodic auto-sync per vault | Uses `auto_sync` and `sync_interval` columns |
| **Auto-Sync Mode** | Trigger sync automatically on watcher events or schedule | Combines Watcher + Scheduler |
| **`stash-and-retry`** | Stash uncommitted changes, pull remote, pop stash on conflict | Supported in schema and GitService |
| **Cooperative Abort** | Gracefully cancel running sync jobs at step boundaries (`abort_requested_at`) | Follow-up to stateless abort |
| **`config.toml` Support** | Pre-boot daemon configuration (custom port, log level, DB path) | See [daemon-hardening.md](file:///home/nntthu/Development/obsync/.plans/daemon-hardening.md) |
| **Input Sanitization** | Strict path traversal checks on `local_path`, remote URL schemes | See [daemon-hardening.md](file:///home/nntthu/Development/obsync/.plans/daemon-hardening.md) |
| **`obsync init`** | Interactive vault setup (clone remote or `git init` + configure) | Complements `obsync vault add` |
| **Mobile Core (`obsync-core`)** | Extract sync engine as embedded library for Android & iOS apps | See [daemon-rust-migration.md](file:///home/nntthu/Development/obsync/.plans/daemon-rust-migration.md) |
| **Soft Delete for Vaults** | Archive/untrack vaults without hard DB deletes | |
