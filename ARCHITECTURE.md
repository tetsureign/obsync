# Architecture

obsync is a two-process system: a persistent **daemon** owns vault access,
Git, synchronization, and state; a short-lived **CLI** is the user-facing
HTTP client. This document describes the current implementation and the
decisions behind its boundaries.

## System shape

```text
┌─────────────────────────────────────────────────────────────┐
│ CLI (Rust)                                                  │
│ clap · reqwest · tokio · output rendering                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ authenticated HTTP on 127.0.0.1
┌──────────────────────────▼──────────────────────────────────┐
│ Daemon (NestJS / TypeScript)                                │
│  HTTP API · CQRS · per-vault queue · sync state              │
│  GitService · SQLite/Drizzle · conflict records             │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
          local vault files       Git remote
                                      │
                              SSH / HTTPS via host Git
```

The daemon is the only component that performs filesystem and Git operations.
The CLI reads the daemon lockfile, authenticates requests, and renders the
responses. Remote synchronization is still ordinary Git traffic; the daemon
itself is not a remote service.

## Request and sync flow

```text
obsync sync <vault-name>
        │
        ├─ read daemon.json and validate the daemon PID
        ├─ POST /vaults/:name/sync with the session Bearer token
        ├─ validate the request through Zod
        ├─ resolve the vault by name and persist a queued operation
        ├─ enqueue work in the per-vault SyncQueue
        └─ run GitService: pull → stage → commit → push
```

The command returns the queued operation. `obsync sync status <vault-name>`
combines database history with the queue’s in-memory runtime state so a caller
can see both persisted work and work currently held by the daemon.

## Design decisions

### Keep the CLI thin

The CLI is a presentation and transport layer. It does not contain Git or sync
orchestration logic. That logic belongs in the daemon because the daemon stays
alive between invocations and can serialize work across multiple clients.

This also gives the CLI a small, predictable responsibility: parse arguments,
make authenticated HTTP requests, and render domain responses and errors.

### Use names at the API boundary and UUIDs in storage

Vault names are unique and are the stable identifiers users type, so public
routes use names such as `/vaults/:name/sync`. The database retains UUIDs for
foreign keys and operation records. Repositories translate between the two at
the boundary where that is useful.

This keeps the public API readable without coupling user-facing commands to
database identifiers.

### Resolve Git configuration at runtime

The vault registry stores the local path and sync settings, but not the remote
URL or current branch. `GitService` reads the configured remote and checked-out
branch from the repository when it performs an operation.

`.git/config` and `HEAD` therefore remain the source of truth. Changing a
repository’s remote or branch does not require a second copy of that state in
the obsync database.

### Treat the vault as a shared mutable resource

The daemon may be one of several actors changing a vault. Obsidian, editors,
shell Git commands, Git hooks, other local processes, and other obsync clients
can all modify the working tree. The queue therefore coordinates daemon-owned
work, but does not pretend to be a global filesystem lock.

### Combine an in-memory queue with a database invariant

`SyncQueue` keeps a `p-queue` for each vault name with concurrency `1`. This
prevents Git operations for one vault from overlapping while allowing different
vaults to proceed independently.

The database also has a partial unique index over active operations:

```sql
CREATE UNIQUE INDEX sync_operations_one_active_per_vault
ON sync_operations(vault_id)
WHERE status IN ('queued', 'running');
```

The queue provides runtime scheduling; the index protects the invariant when
two requests race or when the process is restarted. The database is the final
authority for whether a vault already has active work.

### Make the sync pipeline explicit

Every manual sync follows the same ordered pipeline:

```text
pull → stage → commit → push
```

Before each Git phase, the runner records the current step and running status.
Successful completion records `success` with step `done` and updates the
vault’s `lastSyncedAt`. Failures are mapped to typed domain errors and stored
against the operation when possible.

The pipeline is deliberately a fresh convergence attempt, not a resume system.
On daemon startup, active database operations are marked `aborted` because the
queue is in memory and cannot safely be reconstructed after a process crash.

## Daemon components

| Component | Responsibility |
| --- | --- |
| `VaultModule` | Register, query, update, and delete vaults; validate Git-backed paths at registration. |
| `SyncModule` | Enqueue syncs, run the pipeline, expose status/history, and coordinate Git actions. |
| `GitModule` | The sole boundary for `simple-git`; maps Git failures to typed application errors. |
| `SyncQueueModule` | Maintain one in-memory queue per vault with concurrency `1`. |
| `ConflictModule` | Persist conflict records produced by failed merge operations. |
| `DatabaseModule` | Provide SQLite through Drizzle, with WAL mode and foreign keys enabled. |

Nest’s global application layer applies Zod validation, response serialization,
typed exception handling, and the session-token guard to the HTTP API.

## Persistence and state

### Vaults

Each vault has a unique internal ID, unique name, normalized local path, sync
settings, conflict strategy, and timestamps. `remote` and `branch` are
intentionally absent; they are resolved from Git at operation time.

The schema currently stores `autoSync` and `syncInterval` so the configuration
surface can represent them, but the current daemon only executes manual syncs.
There is no active scheduler in the current implementation.

### Sync operations

Sync operations use these statuses:

```text
queued → running → success
                   └→ failed
queued/running → aborted
```

The `step` field is one of `pull`, `stage`, `commit`, `push`, or `done`. Active
rows are `queued` and `running`; terminal rows are `success`, `failed`, and
`aborted`. A failed or aborted operation retains the step at which it stopped.

Final-state persistence is retried because recording the outcome should not
turn a completed Git operation into an unreported one merely because SQLite
was temporarily unavailable.

### Conflicts

Git merge conflicts are converted into `MergeConflictError`. With the current
`log-and-skip` strategy, the daemon records the vault and conflicted file list
in `conflict_records` and fails the sync operation. The `stash-and-retry`
strategy is represented in the schema and CLI configuration, but its retry flow
and a conflict-resolution API are not complete.

## HTTP API

All API routes are protected by the session-token guard, including `/health`.
The daemon binds only to `127.0.0.1`; see [SECURITY_MODEL.md](SECURITY_MODEL.md)
for the authentication and lockfile rationale.

### Vaults

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/vaults` | List registered vaults. |
| `POST` | `/vaults` | Register a Git-backed vault. |
| `GET` | `/vaults/by-path?localPath=` | Find a vault by local path. |
| `GET` | `/vaults/:name` | Get vault details. |
| `PATCH` | `/vaults/:name` | Update vault settings. |
| `DELETE` | `/vaults/:name` | Remove a vault registration. |

### Sync and Git actions

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/vaults/:name/sync` | Enqueue a full sync. |
| `POST` | `/vaults/:name/abort` | Abort queued work for a vault. |
| `GET` | `/vaults/:name/status` | Return active work, recent history, and queue runtime state. |
| `GET` | `/vaults/:name/syncs` | Return the vault’s sync history. |
| `GET` | `/vaults/:name/git-status` | Read Git status. |
| `GET` | `/vaults/:name/git-diff` | Read a Git diff. |
| `POST` | `/vaults/:name/git-pull` | Run Git pull. |
| `POST` | `/vaults/:name/git-stage` | Run Git add. |
| `POST` | `/vaults/:name/git-commit` | Run Git commit. |
| `POST` | `/vaults/:name/git-push` | Run Git push. |

### Health

`GET /health` returns the daemon health response and is also authenticated by
the global guard. It is used by daemon startup checks and the CLI’s connectivity
probe.

The current API does not expose an SSE event stream.

## CLI surface

| Command | Purpose |
| --- | --- |
| `obsync vault add <path> [options]` | Register a vault. |
| `obsync vault list` | List registered vaults. |
| `obsync vault info <name>` | Show vault details. |
| `obsync vault edit <name> [options]` | Update vault settings. |
| `obsync vault delete <name>` | Delete a vault registration. |
| `obsync sync <name> [options]` | Enqueue a manual sync. |
| `obsync sync status <name>` | Show active and recent sync operations. |

The CLI discovers the daemon from the platform data directory’s
`daemon.json`. By default it uses the lockfile’s recorded port; `--daemon-url`
and `OBSYNC_DAEMON_URL` can override the URL while retaining the lockfile
token. The lockfile lifecycle and platform paths are documented in
[SECURITY_MODEL.md](SECURITY_MODEL.md).

## Git credentials

obsync does not maintain an application-specific credential store. The daemon
inherits the host Git environment, including SSH keys, SSH agents, and Git
credential helpers. This keeps remote authentication in the same place as a
normal Git workflow and lets Git report authentication failures through the
daemon’s typed error mapping.

## Current boundaries

The current design intentionally leaves these outside the shipped surface:

- remote daemon access; the daemon is local-only;
- Git logic in the CLI;
- automatic scheduling, file watching, and SSE events;
- completed conflict-resolution and stash-and-retry flows;
- in-app management of Git credentials.
