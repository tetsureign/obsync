# obsync — Implementation Roadmap

> Derived from cross-referencing all `.plans/` documents against the current codebase.
> Organizes remaining work into logical phases with clear dependency ordering.

---

## Phase 1 — Foundation Fixes & Quickstart Demo

> **Scope**: Small, targeted corrections to already-implemented code & quickstart demo Docker template.
> **Plans addressed**: `sync-operation-robustness.md`, `architecture-decisions.md`, `vault-git-setup.md`, `remote-daemon-selfhosting.md`

### 1.1 `MergeConflictError → conflict_record` in Runner

<details>
<summary>Done</summary>

- In `sync-job.runner.ts`, add an explicit `catch` branch before the generic catch:
  - If `err instanceof MergeConflictError` → insert a `conflict_records` row (vault, files, `strategy = log-and-skip`) → re-throw
  - The existing `recordFailureBestEffort` then records `MERGE_CONFLICT` on the sync operation
- Requires injecting a `ConflictRepository` (or inline conflict insert via `SyncRepository`) into the runner

**Actual Implementation**: Record the conflict right inside `recordFailureBestEffort`

</details>

### 1.2 Wire `obsync sync` CLI

<details>
<summary>Done</summary>

- `Commands::Sync` in `cli/src/main.rs` currently only fetches the vault name and prints it — it never calls the sync API
- Wire it to `api.sync_vault(vault_id, ...)` with a new `sync_vault()` method on `ApiClient`
- Print the queued sync operation ID + status

</details>

### 1.3 Update E2E Tests

- `vault.e2e-spec.ts` was written before `vault-git-setup.md` landed. Two categories of fixes:

**Schema drift** (straightforward):

- Remove `remote` and `branch` from all request payloads and response assertions
- Remove any assertions on `res.body.branch` or `res.body.remote`

**Git validation** (needs mocking):

- `CreateVaultHandler` now calls `GitService.validateVaultGitRepo()` + `getEffectiveRemote()` before inserting — all happy-path create tests currently hit these and fail on fake paths like `/tmp/docs`
- **Approach**: mock `GitService` at the `Test.createTestingModule()` boundary using `{ provide: GitService, useValue: mockGitService }`. Mock the relevant methods to return success by default; override per-test for error-path coverage.
- This keeps tests fast, deterministic, and network-free — simulating a remote auth failure or network drop is just `jest.fn().mockRejectedValueOnce(new RemoteAuthError(...))`
- The `vault/` subdirectory (`test/vault/`) is empty — move vault domain tests there, add coverage for the new Git-validation paths per `vault-git-setup.md`

**Sync robustness tests** (new):

- Add tests per `architecture-decisions.md` checklist: startup abort, stale-abort before queue, in-process busy (no abort), merge conflict → `conflict_record` row created

### 1.4 Demo Docker Setup

- Minimal `docker-compose.yml` for evaluating `obsync-daemon` locally in Docker
- Volume mount for sample vault and SQLite data directory
- Health check probe (`GET /health`)

---

## Phase 2 — Daemon Hardening

> **Scope**: Full implementation of `daemon-hardening.md`.
> **Blocks**: Phase 3 (CLI can't reliably discover port or authenticate)

### 2.1 Port 0 Binding + Lockfile Write

- Change `main.ts` to `await app.listen(0, '127.0.0.1')` (let OS assign port)
- After listen, read back `app.getHttpServer().address().port`
- Generate a random bearer token (`crypto.randomBytes(32).toString('hex')`)
- Write `~/.config/obsync/daemon.json` (mode 600) with `{ port, token, pid }`
- Use `env-paths` npm package to resolve the platform-correct config dir

### 2.2 Auth Guard

- NestJS guard on all routes: validate `Authorization: Bearer <token>` against the token written at startup
- Requests without a valid token → `401 Unauthorized`
- `/health` exempted (needed for CLI's pre-command probe)

### 2.3 Lockfile Delete on Shutdown

- Implement `OnApplicationShutdown` in the bootstrap service
- Delete `daemon.json` on clean shutdown

### 2.4 `env-paths` Integration + Production DB Path

- Replace the current `./local.db` default with platform-correct path resolution:
  - Linux: `~/.local/share/obsync/obsync.db`
  - macOS: `~/Library/Application Support/obsync/obsync.db`
  - Windows: `%LOCALAPPDATA%\obsync\obsync.db`
- `mkdir -p` the data dir on first run
- Keep `./local.db` for `NODE_ENV !== 'production'` (existing dev ergonomics stay)

### 2.5 Scope Note

- Full `config.toml` daemon settings loading is **post-MVP**
- For MVP, all daemon settings come from env vars (existing `@nestjs/config` + `.env` is fine)

---

## Phase 3 — CLI Completion

> **Scope**: All remaining planned CLI commands.
> **Depends on**: Phase 2 (lockfile-based port + token discovery)

### 3.1 Lockfile-Based Daemon Discovery

- Before every command (except `--help`, `--version`): read `~/.config/obsync/daemon.json`
- Validate PID is alive (`kill(pid, 0)` equivalent)
- Use the port and token from the lockfile instead of the hardcoded default
- `OBSYNC_DAEMON_URL` env var still overrides for remote/scripting use

### 3.2 Auth Header on All Requests

- `ApiClient` reads the token from the lockfile and attaches `Authorization: Bearer <token>` to every request

### 3.3 Remaining Commands

| Command                          | Backend status                                                    |
| -------------------------------- | ----------------------------------------------------------------- |
| `obsync vault remove <id\|name>` | `DELETE /vaults/:id` exists; add CLI subcommand                   |
| `obsync status [<id\|name>]`     | `GET /vaults/:id/status` exists, returns rich data; wire + render |
| `obsync log [<id\|name>]`        | `GET /vaults/:id/syncs` exists; wire + render history table       |
| `obsync sync [<id\|name>]`       | Stubbed — complete wiring (Phase 1.2)                             |

### 3.4 `obsync init` — Post-MVP

- Moved to post-MVP. The `vault add` flow (register an already-prepared Git repo) covers the MVP use case.

---

## Phase 4 — NAS Git Remote Specs

> **Scope**: Implementation of `remote-daemon-selfhosting.md`.

### 4.1 NAS Git Remote Documentation

- Document self-hosting via NAS Git remotes (SSH keys, Gitea, bare repos)

---

## Phase 5 — Unix Installer & Daemon Gate

> **Scope**: Full implementation of `cli-daemon-onboarding.md`.
> **Depends on**: Phase 2 (lockfile), Phase 3 (CLI completion)

### 5.1 Hard Daemon Gate & Offline Diagnostics

- Upgrade CLI soft warning (`eprintln!`) to a hard daemon gate
- If lockfile is missing/stale → print clear diagnostic error to `stderr` with service management commands and exit with non-zero code

### 5.2 Unix Installation Script (`install.sh`)

- Shell script for Linux and macOS
- Installs `obsync` and `obsync-daemon` binaries into standard path (`~/.local/bin`)
- Registers and starts native background service:
  - **Linux**: `systemd` user service (`~/.config/systemd/user/obsync-daemon.service`)
  - **macOS**: `launchd` plist (`~/Library/LaunchAgents/com.obsync.daemon.plist`)

### 5.3 `--no-interactive` / `--batch` Flag

- Returns non-zero exit code immediately if daemon unreachable
- For CI/CD, git hooks, scripting use

---

## Post-MVP (Deferred)

| Feature                                  | Source plan                 | Notes                                         |
| ---------------------------------------- | --------------------------- | --------------------------------------------- |
| `WatcherModule` (chokidar dirty flag)    | `initial-plan.md`           | `isDirty` field reserved in schema            |
| `SchedulerModule` (per-vault cron)       | `initial-plan.md`           | `autoSync` + `syncInterval` in schema         |
| SSE gateway + `obsync watch`             | `initial-plan.md`           | `EventBus`, `@Sse('/events')`, ratatui TUI    |
| `ConfigModule` (TOML export/import)      | `initial-plan.md`           | Vault registry export, interactive path remap |
| Auto-sync mode (WatcherModule → enqueue) | `initial-plan.md`           | Needs WatcherModule + SchedulerModule first   |
| Cooperative abort (`abortRequestedAt`)   | `architecture-decisions.md` | Post-MVP per plan                             |
| `stash-and-retry` conflict strategy      | `architecture-decisions.md` | `stash`/`stashPop` already in GitService      |
| `config.toml` daemon settings loading    | `daemon-hardening.md`       | preferred_port, log_level                     |
| Input validation hardening               | `daemon-hardening.md`       | Path traversal, remote URL scheme check       |
| Packaging (nFPM deb/rpm, bundled Node)   | `initial-plan.md`           | After service model is stable                 |
| Explicit multi-remote management         | `vault-git-setup.md`        | Drift detection deferred with it              |
| `obsync config export/import` CLI        | `initial-plan.md`           | Needs ConfigModule first                      |
| `obsync init`                            | `vault-git-setup.md`        | Clone/init Git setup command                  |
| Soft delete for vaults                   | `initial-plan.md`           | Hard deletes only for MVP                     |
