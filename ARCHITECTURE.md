# Architecture

obsync is a two-process system: a **daemon** (NestJS/TypeScript) that owns all intelligence, and a thin **CLI** (Rust) that is purely a presentation layer.

---

## Two-process model

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (Rust)                                                 │
│  clap · reqwest · tokio                                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE (localhost)
┌────────────────────────▼────────────────────────────────────┐
│  Daemon (NestJS)                                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ VaultModule │  │  SyncModule │  │  GitModule       │   │
│  │ CQRS        │  │  CQRS       │  │  simple-git      │   │
│  │ registry    │  │  pipeline   │  │  wrapper         │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────┘   │
│         │                │                                  │
│  ┌──────▼────────────────▼──────────────────────────────┐  │
│  │  SyncQueue (p-queue, concurrency 1 per vault)        │  │
│  │  serialises jobs · best-effort retry on final state  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SQLite · Drizzle ORM                                │  │
│  │  vaults · sync_operations · conflict_records         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Why two processes?

The daemon is a persistent background service with in-memory state (sync queue, per-vault queues). The CLI is ephemeral — each invocation is a single HTTP call. This separation means:

- The sync queue is always running, even when the terminal is closed.
- The CLI can be a thin Rust binary with no runtime overhead.
- Multiple CLI invocations (or other HTTP clients) can query the daemon simultaneously.

---

## Daemon

### Tech stack

| Layer          | Tool                                                 |
| -------------- | ---------------------------------------------------- |
| Framework      | NestJS (TypeScript)                                  |
| Git operations | `simple-git`                                         |
| Job queue      | `p-queue` (in-memory, per vault, concurrency 1)      |
| ORM            | Drizzle ORM                                          |
| Database       | SQLite (`node:sqlite` via `drizzle-orm/node-sqlite`) |
| Validation     | Zod + `nestjs-zod`                                   |
| Pattern        | CQRS (`@nestjs/cqrs`) — CommandBus + QueryBus        |

### Modules

#### `VaultModule`

Owns the vault registry. Vaults are registered by local path — `remote` and `branch` are **not** persisted; they are resolved dynamically from the repository's `.git/config` at sync time via `GitService`.

Commands: `CreateVaultCommand`, `UpdateVaultCommand`, `DeleteVaultCommand`
Queries: `GetVaultQuery`, `ListVaultsQuery`, `GetVaultByPathQuery`

Key invariant: `CreateVaultHandler` validates that the path is a real Git repo with a configured remote before inserting. If not, it returns a domain error prompting the user to run `obsync init`.

#### `SyncModule`

Owns the sync pipeline. Sync is always a full convergence from the current vault state — not a resume of a previous step.

Commands: `SyncVaultCommand`, `AbortSyncCommand`, `PullVaultCommand`, `StageVaultCommand`, `CommitVaultCommand`, `PushVaultCommand`
Queries: `GetSyncStatusQuery`, `GetSyncHistoryQuery`, `GetGitStatusQuery`, `GetGitDiffQuery`

The `SyncJobRunner` executes: `pull → stage → commit → push`. Each step is atomically recorded in the DB before Git work begins — if the step cannot be persisted, the runner stops before touching the filesystem.

#### `GitModule`

Wraps `simple-git` with typed domain errors. All Git operations go through `GitService` — the rest of the codebase never calls `simple-git` directly.

Key helpers:

- `validateVaultGitRepo(path)` — checks `git.checkIsRepo()`
- `getEffectiveRemote(path, alias?)` — resolves the configured remote URL at runtime
- `getEffectiveBranch(path)` — resolves the current checked-out branch at runtime
- `inspectExistingVault(path)` — returns remote + branch in one call (used at registration)

Error mapping: `GitError` → `MergeConflictError | RemoteAuthError | NetworkError | DirtyWorkingTreeError | NotAGitRepoError | InvalidFilePathsError | GitOperationError`

#### `SyncQueueModule`

A per-vault `p-queue` with `concurrency: 1`. Guarantees syncs never overlap for the same vault. Different vaults can sync independently.

Key methods:

- `addToVaultQueue(vaultId, fn)` — enqueues a job
- `hasVaultWorks(vaultId)` — `queue.size + queue.pending > 0`
- `getVaultQueueStatus(vaultId)` — returns size, pending count, running tasks
- `abortVaultQueue(vaultId)` — clears queued (not in-flight) jobs

#### `DatabaseModule`

Provides an injectable `Database` class wrapping Drizzle ORM over `node:sqlite`. Runs `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` on `configure()`.

Database path resolution: defaults to `obsync.db` inside the platform data dir via `env-paths` (`~/.local/share/obsync` on Linux, `~/Library/Application Support/obsync` on macOS). `DB_FILE_NAME` env var is an optional override (used by tests and local dev).

---

## Sync state machine

Every sync creates a `sync_operations` row. States and transitions:

```
queued → running → success/done
                → failed/done
       → aborted/done
```

**Active states**: `queued`, `running`  
**Terminal states**: `success/done`, `failed/done`, `aborted/done`

The `step` field tracks exactly where the runner is or was: `pull | stage | commit | push | done`.

A partial unique index enforces at most one active operation per vault at the DB level:

```sql
CREATE UNIQUE INDEX sync_operations_one_active_per_vault
ON sync_operations(vault_id)
WHERE status IN ('queued', 'running');
```

### Startup reconciliation

On daemon start, `AppService.onApplicationBootstrap()` aborts all dangling `queued` or `running` operations with error code `DAEMON_INTERRUPTED`. This is cleanup, not recovery — a fresh `obsync sync` creates a new operation from the current vault state.

### Stale operation abort

Before enqueuing a new sync, `SyncVaultHandler` checks whether the per-vault queue has in-memory work:

- If **busy** (in-flight) → skip abort, proceed to queue the new job behind it.
- If **idle** → abort any stale `queued`/`running` DB record, then create a fresh `queued/pull` operation.

---

## Database schema

```typescript
vaults {
  id            text PK
  name          text UNIQUE
  localPath     text UNIQUE
  isDirty       boolean          // reserved for post-MVP auto-sync
  autoSync      boolean          // reserved for post-MVP scheduler
  syncInterval  integer          // seconds, reserved for post-MVP scheduler
  conflictStrategy  text         // 'log-and-skip' | 'stash-and-retry'
  lastSyncedAt  timestamp
  createdAt     timestamp
  updatedAt     timestamp
}

sync_operations {
  id         text PK
  vaultId    text → vaults.id (CASCADE DELETE)
  status     text  // queued | running | success | failed | aborted
  step       text  // pull | stage | commit | push | done
  error      text  // domain error code, e.g. MERGE_CONFLICT
  commitSha  text  // null if nothing was committed
  startedAt  timestamp
  createdAt  timestamp
  updatedAt  timestamp
}

conflict_records {
  id        text PK
  vaultId   text → vaults.id (CASCADE DELETE)
  files     text  // JSON array of conflicted file paths
  strategy  text  // 'log-and-skip' | 'stash-and-retry'
  resolved  boolean
  createdAt timestamp
  updatedAt timestamp
}
```

`remote` and `branch` are intentionally absent from `vaults` — Git repository configuration (`.git/config` and `HEAD`) is the sole source of truth, resolved at runtime via `GitService`.

---

## API surface

### Vaults

| Method   | Path                         | Description                      |
| -------- | ---------------------------- | -------------------------------- |
| `GET`    | `/vaults`                    | List all vaults                  |
| `POST`   | `/vaults`                    | Register a vault                 |
| `GET`    | `/vaults/by-path?localPath=` | Look up vault by filesystem path |
| `GET`    | `/vaults/:id`                | Get vault detail                 |
| `PATCH`  | `/vaults/:id`                | Update vault config              |
| `DELETE` | `/vaults/:id`                | Remove vault from registry       |

### Sync

| Method | Path                 | Description                                             |
| ------ | -------------------- | ------------------------------------------------------- |
| `POST` | `/vaults/:id/sync`   | Enqueue a manual sync                                   |
| `POST` | `/vaults/:id/abort`  | Abort a pending sync (clears in-memory queue)           |
| `GET`  | `/vaults/:id/status` | Active operation + recent history + queue runtime state |
| `GET`  | `/vaults/:id/syncs`  | Full sync history for vault                             |

### Low-level Git (debug / advanced)

| Method | Path                     | Description  |
| ------ | ------------------------ | ------------ |
| `GET`  | `/vaults/:id/git-status` | `git status` |
| `GET`  | `/vaults/:id/git-diff`   | `git diff`   |
| `POST` | `/vaults/:id/git-pull`   | `git pull`   |
| `POST` | `/vaults/:id/git-stage`  | `git add`    |
| `POST` | `/vaults/:id/git-commit` | `git commit` |
| `POST` | `/vaults/:id/git-push`   | `git push`   |

### Health

| Method | Path      | Description           |
| ------ | --------- | --------------------- |
| `GET`  | `/health` | Daemon liveness probe |

### Events (SSE)

> ⚠️ Not yet implemented. Tracked in [ROADMAP.md Post-MVP](.plans/ROADMAP.md).

`GET /events` — SSE stream of typed daemon events (`sync:start`, `sync:done`, `sync:failed`, `conflict`, `vault:dirty`).

---

## CLI

### Tech stack

| Layer            | Tool                  |
| ---------------- | --------------------- |
| Argument parsing | `clap` (derive-based) |
| HTTP client      | `reqwest`             |
| Async runtime    | `tokio`               |

The CLI has no Git logic. It sends HTTP requests to the daemon and renders the responses.

### Daemon discovery

The daemon listens on a fixed default port (`7274`), overridable via `PORT` env var. The CLI defaults to `http://127.0.0.1:7274`, overridable via `OBSYNC_DAEMON_URL` env var. In Phase 2, the lockfile (`~/.config/obsync/daemon.json`) will carry `{ token, pid }` for authentication and PID validation — the port remains fixed.

### Commands

| Command                                   | Status                          |
| ----------------------------------------- | ------------------------------- |
| `obsync vault add <path> [--name <name>]` | ✅ Implemented                  |
| `obsync vault list`                       | ✅ Implemented                  |
| `obsync sync <vault-id>`                  | 🟡 Stub — enqueue not yet wired |
| `obsync vault remove <id>`                | ❌ Phase 3                      |
| `obsync status [<id>]`                    | ❌ Phase 3                      |
| `obsync log [<id>]`                       | ❌ Phase 3                      |
| `obsync watch`                            | ❌ Post-MVP (needs SSE)         |
| `obsync config export/import`             | ❌ Post-MVP                     |
| `obsync init`                             | ❌ Post-MVP                     |

---

## Git credentials

**System credential store only.** obsync has no in-app credential management. The daemon inherits the user's environment — SSH keys, macOS Keychain, `git-credential-helper`, etc. are all managed outside the app.

`RemoteAuthError` is surfaced to the user as-is.

---

## Post-MVP features (designed, not yet implemented)

| Feature                  | Notes                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **WatcherModule**        | `chokidar` per-vault file watcher; sets `isDirty` flag. `isDirty` field is already in the schema. |
| **SchedulerModule**      | Per-vault cron using `@nestjs/schedule`. `autoSync` + `syncInterval` fields already in schema.    |
| **SSE gateway**          | `@Sse('/events')` endpoint, RxJS `Subject`, typed event bus. Powers `obsync watch`.               |
| **Config export/import** | TOML vault registry export with interactive path remapping on import.                             |
| **Cooperative abort**    | `abortRequestedAt` field on sync operations; runner checks between Git phases.                    |
| **`stash-and-retry`**    | Conflict strategy. `stash()` and `stashPop()` already implemented in `GitService`.                |
| **Daemon hardening**     | Lockfile, per-session token auth guard, `env-paths` production path resolution. Phase 2.          |
| **Demo Docker Compose**  | Minimal demo `docker-compose.yml` for local container evaluation. Phase 1.                        |
| **Unix Installer**       | `install.sh` script for Linux/macOS binary placement & systemd/launchd service setup. Phase 5.    |
