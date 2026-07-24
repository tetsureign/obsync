# obsync — Implementation Roadmap

> Derived from cross-referencing all `.plans/` documents against the current codebase.
> Organizes remaining work into logical phases with clear dependency ordering.
>
> **Decisions locked in:**
> - WAL mode: ✅ already implemented (`PRAGMA journal_mode = WAL` + `foreign_keys = ON` in `Database.configure()`)
> - E2E tests: mock `GitService` at the module boundary (not real temp repos)
> - `config.toml` daemon settings loading: post-MVP
> - `obsync init`: post-MVP

---

## Dependency Graph (high-level)

```
Phase 1: Foundation Fixes
    ↓
Phase 2: Daemon Hardening          ← blocks CLI from being reliable
    ↓
Phase 3: CLI Completion            ← needs lockfile port discovery + auth token
    ↓
Phase 4: Remote Self-Hosting       ← needs auth layer from Phase 2
    ↓
Phase 5: CLI Onboarding Wizard     ← needs CLI completion + lockfile + remote support
    ↓
Post-MVP: Auto-Sync, SSE, Config, obsync init
```

---

## Phase 1 — Foundation Fixes

> **Scope**: Small, targeted corrections to already-implemented code.
> **Plans addressed**: `sync-operation-robustness.md`, `architecture-decisions.md`, `vault-git-setup.md`

These are loose ends in otherwise-implemented features. None require new modules.

### 1.1 `MergeConflictError → conflict_record` in Runner
- In `sync-job.runner.ts`, add an explicit `catch` branch before the generic catch:
  - If `err instanceof MergeConflictError` → insert a `conflict_records` row (vault, files, `strategy = log-and-skip`) → re-throw
  - The existing `recordFailureBestEffort` then records `MERGE_CONFLICT` on the sync operation
- Requires injecting a `ConflictRepository` (or inline conflict insert via `SyncRepository`) into the runner

### 1.2 Wire `obsync sync` CLI
- `Commands::Sync` in `cli/src/main.rs` currently only fetches the vault name and prints it — it never calls the sync API
- Wire it to `api.sync_vault(vault_id, ...)` with a new `sync_vault()` method on `ApiClient`
- Print the queued sync operation ID + status

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
- The CLI will write a minimal `~/.config/obsync/config.toml` in Phase 4 (Option C: remote daemon URL + API key) — this is CLI-side only, not a daemon ConfigModule

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
| Command | Backend status |
|---|---|
| `obsync vault remove <id\|name>` | `DELETE /vaults/:id` exists; add CLI subcommand |
| `obsync status [<id\|name>]` | `GET /vaults/:id/status` exists, returns rich data; wire + render |
| `obsync log [<id\|name>]` | `GET /vaults/:id/syncs` exists; wire + render history table |
| `obsync sync [<id\|name>]` | Stubbed — complete wiring (Phase 1.2) |

### 3.4 `obsync init` — Post-MVP
- Moved to post-MVP. The `vault add` flow (register an already-prepared Git repo) covers the MVP use case.

---

## Phase 4 — Remote Self-Hosting

> **Scope**: Full implementation of `remote-daemon-selfhosting.md`.
> **Depends on**: Phase 2 auth guard (persistent API key is a superset of the local token)

### 4.1 Dual Auth Mode
- Local daemon: per-session token from lockfile (Phase 2)
- Remote daemon: persistent `OBSYNC_API_KEY` env var
- The auth guard already validates a token; this just changes how the token is sourced

### 4.2 `HOST` Binding Mode
- Expose `HOST` env var; default to `127.0.0.1` (safe local-only default)
- Remote/container deployments set `HOST=0.0.0.0`
- When `HOST != 127.0.0.1`: use fixed `PORT`, skip lockfile write, enforce `OBSYNC_API_KEY` is set

### 4.3 CORS Update
- When `HOST=0.0.0.0`: set `origin: false`
- Local stays as `origin: '127.0.0.1'`

### 4.4 `PUID`/`PGID` Support
- Drop privileges on startup when running inside Docker

### 4.5 Docker Compose Template
- `docker-compose.yml` with vault mount, SSH key mount, persistent data volume, healthcheck
- `.env.example` with all required vars documented

---

## Phase 5 — CLI Onboarding Wizard

> **Scope**: Full implementation of `cli-daemon-onboarding.md`.
> **Depends on**: Phase 2 (lockfile), Phase 3 (CLI completion), Phase 4 (remote mode)

### 5.1 Hard Daemon Gate
- Upgrade the current soft warning (`eprintln!`) to an actual gate
- If lockfile is missing/stale and no `OBSYNC_DAEMON_URL` override → trigger wizard (unless `--no-interactive` / `--batch`)

### 5.2 Interactive Setup Wizard
- Use `inquire` or `dialoguer` Rust crate for terminal prompts
- Options:
  1. **Native Service** — write systemd user unit / launchd plist / Windows task, enable + start, verify via health probe
  2. **Docker Container** — check `docker` is available, prompt vault dir + port, run `docker run ...`, verify
  3. **Remote Daemon** — prompt URL + API key, verify connection, save to `~/.config/obsync/config.toml`
  4. **Skip** — exit with a helpful message

### 5.3 `--no-interactive` / `--batch` Flag
- Suppress wizard, fail immediately with non-zero exit code if daemon unreachable
- For CI/CD, git hooks, scripting use

---

## Post-MVP (Deferred)

| Feature | Source plan | Notes |
|---|---|---|
| `WatcherModule` (chokidar dirty flag) | `initial-plan.md` | `isDirty` field reserved in schema |
| `SchedulerModule` (per-vault cron) | `initial-plan.md` | `autoSync` + `syncInterval` in schema |
| SSE gateway + `obsync watch` | `initial-plan.md` | `EventBus`, `@Sse('/events')`, ratatui TUI |
| `ConfigModule` (TOML export/import) | `initial-plan.md` | Vault registry export, interactive path remap |
| Auto-sync mode (WatcherModule → enqueue) | `initial-plan.md` | Needs WatcherModule + SchedulerModule first |
| Cooperative abort (`abortRequestedAt`) | `architecture-decisions.md` | Post-MVP per plan |
| `stash-and-retry` conflict strategy | `architecture-decisions.md` | `stash`/`stashPop` already in GitService |
| `config.toml` daemon settings loading | `daemon-hardening.md` | preferred_port, log_level |
| Input validation hardening | `daemon-hardening.md` | Path traversal, remote URL scheme check |
| Packaging (nFPM deb/rpm, bundled Node) | `initial-plan.md` | After service model is stable |
| Explicit multi-remote management | `vault-git-setup.md` | Drift detection deferred with it |
| `obsync config export/import` CLI | `initial-plan.md` | Needs ConfigModule first |
| `obsync init` | `vault-git-setup.md` | Clone/init Git setup command |
| Soft delete for vaults | `initial-plan.md` | Hard deletes only for MVP |
