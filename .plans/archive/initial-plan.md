# [[Brainstorming]]
# obsync — project plan

A sync daemon + CLI for managing Obsidian vaults over git. Runs entirely on your local machine. A long-running NestJS daemon handles all git operations, scheduling, and state — a thin Rust CLI is the control interface.

---

## core concept

Two-process model:

- **Daemon** — NestJS app, runs in the background, exposes a localhost HTTP + SSE API
- **CLI** — Rust binary, talks to the daemon over HTTP, renders output in the terminal

The daemon owns all intelligence: vault registry, git operations, file watching, conflict logging, sync scheduling, and config export/import. The CLI is intentionally thin — it sends commands and renders responses.

---

## tech stack

### daemon

|layer|tool|
|---|---|
|framework|NestJS (TypeScript)|
|git operations|`simple-git`|
|file watching|`chokidar`|
|job queue|`p-queue` + `p-retry` (in-memory, no Redis)|
|scheduler|`@nestjs/schedule`|
|ORM|Drizzle ORM|
|database|SQLite — permanent choice, not just MVP. daemon is always co-located with vault files|
|realtime|SSE via `@Sse()` + RxJS `Subject`|
|config format|TOML (`@iarna/toml`)|
|validation|Zod + `nestjs-zod`|
|CQRS|`@nestjs/cqrs`|

### CLI (Rust)

|layer|tool|
|---|---|
|argument parsing|`clap` (derive-based)|
|HTTP client|`reqwest`|
|SSE streaming|`reqwest` with streaming response|
|terminal UI|`crossterm` / `ratatui` (for `obsync watch`)|
|config parsing|`toml` crate|
|async runtime|`tokio`|

---

## planned features

### vault management

- register a vault by local path + remote URL
- list all registered vaults with status (clean / dirty / syncing / error)
- remove a vault from the registry
- per-vault config: branch, auto-sync toggle, sync interval, conflict strategy

### sync engine

- manual sync: pull → stage → commit → push, triggered by CLI command
- auto-sync mode (post-MVP): daemon watches for file changes and syncs automatically
- sync queue: all sync jobs go through BullMQ — serialises concurrent syncs, retries on network failure with exponential backoff, dead-letter queue after max retries
- conflict handling: detect merge conflicts, log them with file list and timestamp, apply configured strategy (`log-and-skip` or `stash-and-retry`)

### file watcher (two modes)

- **manual mode (MVP)**: `chokidar` detects file changes and sets a `dirty` flag on the vault — no auto-enqueue. CLI checks dirty state.
- **auto-sync mode (post-MVP)**: dirty flag triggers immediate enqueue with debounce (e.g. 10s) to avoid spamming commits while typing

### live events (SSE)

- daemon pushes typed events to any connected CLI subscriber
- powers `obsync watch` — a live feed of daemon activity across all vaults
- event types: `sync:start`, `sync:done`, `sync:failed`, `conflict`, `queue:retry`, `vault:dirty`

### config portability

- export all exportable settings to a `.conf` TOML file
- import `.conf` on a new machine with interactive path remapping per vault
- exportable: vault names, remote URLs, branch, sync interval, conflict strategy, ignore patterns
- local-only (never exported): absolute vault paths, daemon socket info

---

## MVP scope

The MVP is a working manual sync tool. Auto-sync and fancy terminal UI are post-MVP.

**MVP includes:**

- daemon with VaultModule, SyncModule, WatcherModule (dirty-flag only), ConflictModule, ConfigModule
- SQLite database with Drizzle (vaults, sync history, conflicts)
- SSE gateway (basic — sync events only)
- BullMQ sync queue with retry on network failure
- Rust CLI with: `add`, `remove`, `list`, `sync`, `status`, `log`, `config export`, `config import`
- TOML config export/import with interactive path remapping

**Post-MVP:**

- auto-sync mode (WatcherModule → enqueue)
- `obsync watch` live feed with ratatui UI
- dead-letter queue + notification on repeated failure
- multi-device conflict dashboard
- account/config sync service (remote store for vault registry + history only — git operations always stay local)

---

## architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (Rust)                                                 │
│  clap · reqwest · crossterm                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE (localhost)
┌────────────────────────▼────────────────────────────────────┐
│  Daemon (NestJS)                                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ VaultModule │  │  SyncModule │  │  WatcherModule   │   │
│  │ registry    │  │  simple-git │  │  chokidar        │   │
│  │ CRUD · paths│  │  pull/push  │  │  dirty flag      │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
│         │                │                   │             │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼─────────┐   │
│  │ Scheduler   │  │  Conflict   │  │  ConfigModule    │   │
│  │ Module      │  │  Module     │  │  TOML export     │   │
│  │ cron jobs   │  │  detect/log │  │  import + remap  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────┘   │
│         │                │                                  │
│  ┌──────▼────────────────▼──────────────────────────────┐  │
│  │  SyncQueue (BullMQ)                                  │  │
│  │  serialises jobs · retries on network failure        │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼───────────────────────────┐  │
│  │  SSE Gateway                                         │  │
│  │  RxJS Subject · pushes typed events to CLI           │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼───────────────────────────┐  │
│  │  SQLite · Drizzle                                    │  │
│  │  vaults · sync history · conflicts                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## NestJS module breakdown

### VaultModule

- `VaultRepository` — owns all Drizzle queries for the vault domain, injects `Database`. no interface abstraction yet — concrete class only. swap the binding in the module when a server mode with Postgres becomes real.
- no service layer — controllers dispatch to `CommandBus` / `QueryBus` directly, handlers talk to the repository directly
- commands: `CreateVaultCommand`, `UpdateVaultCommand`, `DeleteVaultCommand`
- queries: `GetVaultQuery`, `ListVaultsQuery`
- schema: `id`, `name`, `localPath`, `remote`, `branch`, `autoSync`, `syncInterval`, `conflictStrategy`, `isDirty`, `lastSyncedAt`, `updatedAt`, `createdAt`

### SyncModule

- `SyncRepository` — owns all Drizzle queries for sync records, injects `Database`
- no service layer — handlers talk to `SyncRepository` and `simple-git` directly
- commands:
    - `PullVaultCommand` — `git pull`, detects conflicts, signals `ConflictModule` if needed
    - `StageVaultCommand` — `git add .`, respects ignore patterns
    - `CommitVaultCommand` — builds commit message, runs `git commit`
    - `PushVaultCommand` — `git push`, handles network errors and retry signal
    - `SyncVaultCommand` — orchestrates the full pipeline: pull → stage → commit → push. used by scheduler and manual CLI trigger
    - `AbortSyncCommand` — cancel an in-progress sync job in the queue
- queries:
    - `GetGitStatusQuery` — `git status`: dirty files, staged files, untracked
    - `GetGitDiffQuery` — `git diff`: what changed, useful for building commit messages
    - `GetSyncStatusQuery` — daemon-side queue position, syncing or idle
    - `GetSyncHistoryQuery` — past `syncOperations` rows for a vault
- emits `sync:start`, `sync:done`, `sync:failed` events to SSE subject

### WatcherModule

- `WatcherService` — initialises `chokidar` watcher per registered vault on daemon start
- MVP: on file change, sets `isDirty = true` on vault, emits `vault:dirty` event
- post-MVP: debounce → enqueue sync job automatically

### SchedulerModule

- `SyncScheduler` — reads sync interval per vault, registers cron jobs dynamically
- enqueues to `SyncQueue` on each tick

### ConflictModule

- `ConflictRepository` — owns all Drizzle queries for conflict records, injects `Database`
- no service layer — `PullVaultHandler` signals conflict directly, logs via `ConflictRepository`
- logs conflict: vault, files affected, timestamp, raw git output
- strategy applied by `PullVaultHandler`: `log-and-skip` (mark failed, notify) or `stash-and-retry` (stash local, pull, pop)

### ConfigModule

- `ConfigService` — serialises vault registry + settings to TOML
- handles import: parse TOML, validate schema with Zod, prompt for path remapping per vault
- exportable fields only — strips `localPath`, daemon internals
- Zod schemas are the single source of truth for config shape — shared across import validation and HTTP body parsing via `nestjs-zod`

### SyncQueue

- `p-queue` with concurrency 1 — syncs never overlap, no Redis required
- `p-retry` wraps each job: 3 attempts, exponential backoff (1s, 5s, 30s)
- jobs are in-memory only — lost on daemon restart, acceptable for a local tool (next file change or manual trigger re-queues)
- on exhaustion: emit `sync:failed` with reason, log to DB

### SSE Gateway

- `@Sse('/events')` endpoint returning `Observable<MessageEvent>`
- single RxJS `Subject<ObsyncEvent>` shared across all services
- any service injects `EventBus` and calls `eventBus.emit(event)`

---

## database schema (Drizzle)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const vaults = sqliteTable('vaults', {
  id:               text('id').primaryKey(),
  name:             text('name').notNull().unique(),
  localPath:        text('local_path').notNull().unique(),
  remote:           text('remote').notNull(),
  branch:           text('branch').notNull().default('main'),
  isDirty:          integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
  autoSync:         integer('auto_sync', { mode: 'boolean' }).notNull().default(false),
  syncInterval:     integer('sync_interval').notNull().default(5 * 60), // seconds
  conflictStrategy: text('conflict_strategy').notNull().default('log-and-skip'),
  lastSyncedAt:     integer('last_synced_at', { mode: 'timestamp' }),
  ...timestamps,
});

export const syncOperations = sqliteTable(
  'sync_operations',
  {
    id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    vaultId:   text('vault_id').notNull().references(() => vaults.id, { onDelete: 'cascade' }),
    status:    text('status').notNull(), // queued | running | success | failed | aborted
    step:      text('step').notNull(),   // pull | stage | commit | push | done
    error:     text('error'),
    commitSha: text('commit_sha'),       // null if nothing to commit (already up to date)
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sync_operations_one_active_per_vault')
      .on(table.vaultId)
      .where(sql`${table.status} IN ('queued', 'running')`),
  ],
);

export const conflictRecords = sqliteTable('conflict_records', {
  id:        text('id').primaryKey(),
  vaultId:   text('vault_id').notNull().references(() => vaults.id, { onDelete: 'cascade' }),
  files:     text('files').notNull(), // JSON array of file paths
  strategy:  text('strategy').notNull(),
  resolved:  integer('resolved', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});
```

notes:

- `timestamps` spread is reused across all tables — `createdAt` uses `sql\`(unixepoch())`` so SQLite evaluates it per-row at insert time, not once at module load
- `conflictStrategy` valid values are `log-and-skip` and `stash-and-retry` — enforced at the Zod layer, not the DB level
- hard deletes only — removing a vault deletes its registry entry, stops the watcher, and clears pending queue jobs. soft delete is post-MVP.
- `syncOperations` and `conflictRecords` use `onDelete: cascade` — orphaned rows are cleaned up automatically when a vault is deleted
- `syncOperations` is a state machine: `queued → running → success | failed | aborted`
- `step` tracks exactly where a sync failed: `pull | stage | commit | push | done` — actionable diagnostic info
- partial unique index `sync_operations_one_active_per_vault` enforces only one active (`queued` or `running`) operation per vault at the DB level — no application-level mutex needed. completed operations are excluded from the constraint so full history is preserved
- `startedAt` vs `createdAt`: `createdAt` = queued time, `startedAt` = execution start time. the gap is queue wait time
- `commitSha` stores the latest commit hash after a sync — `null` means the vault was already up to date and nothing was committed. post-MVP: expand to a JSON array of SHAs to capture all commits pushed in a single sync
- `remote` is intentionally not unique — two local vaults may point at the same remote legitimately

---

## API endpoints

### vaults

|method|path|description|
|---|---|---|
|`GET`|`/vaults`|list all vaults with status|
|`POST`|`/vaults`|register a new vault|
|`GET`|`/vaults/:id`|get vault detail|
|`PATCH`|`/vaults/:id`|update vault config|
|`DELETE`|`/vaults/:id`|remove vault from registry|
|`GET`|`/vaults/:id/status`|dirty flag, last sync, queue position|

### sync

|method|path|description|
|---|---|---|
|`POST`|`/vaults/:id/sync`|enqueue a manual sync job|
|`GET`|`/vaults/:id/syncs`|sync history for vault|
|`GET`|`/syncs`|global sync history|

### conflicts

|method|path|description|
|---|---|---|
|`GET`|`/vaults/:id/conflicts`|conflict log for vault|
|`PATCH`|`/vaults/:id/conflicts/:cid`|mark conflict resolved|

### config

|method|path|description|
|---|---|---|
|`GET`|`/config/export`|export settings as TOML (download)|
|`POST`|`/config/import`|import a `.conf` file, returns remapping prompt data|
|`POST`|`/config/import/confirm`|confirm vault path remapping and apply|

### events

|method|path|description|
|---|---|---|
|`GET`|`/events`|SSE stream — subscribe to all daemon events|

---

## SSE event types

```typescript
type ObsyncEvent =
  | { type: 'sync:start';   vault: string }
  | { type: 'sync:done';    vault: string; commits: number }
  | { type: 'sync:failed';  vault: string; reason: string; attempt: number }
  | { type: 'conflict';     vault: string; files: string[] }
  | { type: 'queue:retry';  vault: string; attempt: number }
  | { type: 'vault:dirty';  vault: string }
```

---

## CLI commands (Rust)

```
obsync add <path> --remote <url> [--name <name>] [--branch <branch>]
obsync remove <name>
obsync list
obsync status [<name>]          # dirty flag, last sync, queue state
obsync sync [<name>]            # manual sync — all vaults if no name given
obsync log [<name>]             # sync + conflict history
obsync watch                    # subscribe to SSE stream, live output
obsync config export [--out <file>]
obsync config import <file>
```

---

## TOML config format

```toml
[meta]
version = "1.0"
exported_at = "2026-04-08T10:00:00Z"

[settings]
default_branch = "main"
default_sync_interval = 300
default_conflict_strategy = "log-and-skip"

[[vaults]]
name = "work"
remote = "git@github.com:you/work-vault.git"
branch = "main"
auto_sync = false
sync_interval = 300
conflict_strategy = "log-and-skip"
ignore_patterns = [".obsidian/workspace.json"]

[[vaults]]
name = "personal"
remote = "git@github.com:you/personal-vault.git"
branch = "main"
auto_sync = false
sync_interval = 600
conflict_strategy = "stash-and-retry"
ignore_patterns = []
```

Note: `local_path` is intentionally absent — the user remaps paths interactively on import.

---

## project structure

```
obsync/
├── daemon/                         # NestJS app
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── database.ts
│   │   ├── vault/
│   │   │   ├── vault.module.ts
│   │   │   ├── vault.repository.ts
│   │   │   ├── commands/
│   │   │   │   ├── create-vault.command.ts
│   │   │   │   ├── create-vault.handler.ts
│   │   │   │   ├── update-vault.command.ts
│   │   │   │   ├── update-vault.handler.ts
│   │   │   │   ├── delete-vault.command.ts
│   │   │   │   └── delete-vault.handler.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-vault.query.ts
│   │   │   │   ├── get-vault.handler.ts
│   │   │   │   ├── list-vaults.query.ts
│   │   │   │   └── list-vaults.handler.ts
│   │   │   └── schemas/
│   │   │       └── vault.schema.ts
│   │   ├── sync/
│   │   │   ├── sync.module.ts
│   │   │   ├── sync.repository.ts          # syncOperations table
│   │   │   ├── sync.queue.ts
│   │   │   ├── commands/
│   │   │   │   ├── pull-vault.command.ts
│   │   │   │   ├── pull-vault.handler.ts
│   │   │   │   ├── stage-vault.command.ts
│   │   │   │   ├── stage-vault.handler.ts
│   │   │   │   ├── commit-vault.command.ts
│   │   │   │   ├── commit-vault.handler.ts
│   │   │   │   ├── push-vault.command.ts
│   │   │   │   ├── push-vault.handler.ts
│   │   │   │   ├── sync-vault.command.ts
│   │   │   │   ├── sync-vault.handler.ts
│   │   │   │   ├── abort-sync.command.ts
│   │   │   │   └── abort-sync.handler.ts
│   │   │   └── queries/
│   │   │       ├── get-git-status.query.ts
│   │   │       ├── get-git-status.handler.ts
│   │   │       ├── get-git-diff.query.ts
│   │   │       ├── get-git-diff.handler.ts
│   │   │       ├── get-sync-status.query.ts
│   │   │       ├── get-sync-status.handler.ts
│   │   │       ├── get-sync-history.query.ts
│   │   │       └── get-sync-history.handler.ts
│   │   ├── watcher/
│   │   │   ├── watcher.module.ts
│   │   │   └── watcher.service.ts
│   │   ├── scheduler/
│   │   │   ├── scheduler.module.ts
│   │   │   └── sync.scheduler.ts
│   │   ├── conflict/
│   │   │   ├── conflict.module.ts
│   │   │   └── conflict.repository.ts
│   │   ├── config/
│   │   │   ├── config.module.ts
│   │   │   └── config.service.ts
│   │   └── events/
│   │       ├── events.module.ts
│   │       ├── events.gateway.ts   # @Sse endpoint
│   │       └── event-bus.service.ts
│   ├── drizzle/
│   │   └── schema.ts
│   └── package.json
│
└── cli/                            # Rust binary
    ├── src/
    │   ├── main.rs
    │   ├── commands/
    │   │   ├── add.rs
    │   │   ├── remove.rs
    │   │   ├── list.rs
    │   │   ├── sync.rs
    │   │   ├── status.rs
    │   │   ├── log.rs
    │   │   ├── watch.rs
    │   │   └── config.rs
    │   ├── client.rs               # reqwest HTTP client
    │   └── models.rs               # shared types
    └── Cargo.toml
```

---

## build order

A sensible sequence to avoid building against a moving target:

1. scaffold NestJS daemon, set up Drizzle + SQLite schema
2. implement DatabaseModule (injectable Database class, libsql + Drizzle)
3. implement VaultModule — commands and queries, verify with curl/Postman
4. implement SyncModule (simple-git wrapper) and test against a real vault
5. wire SyncQueue (`p-queue` + `p-retry`) — plug sync pipeline in as the processor
6. implement WatcherModule (dirty flag only, MVP mode)
7. implement SchedulerModule
8. implement ConflictModule
9. implement SSE gateway + EventBus
10. implement ConfigModule (export/import)
11. scaffold Rust CLI — start with `add`, `list`, `sync`, `status`
12. wire `obsync watch` to SSE stream
13. implement `config export` / `config import` with interactive remapping
14. polish: error messages, retry feedback, conflict display
# Package goal

- Ship one platform package containing:
  - Rust CLI at /usr/bin/obsync
  - Node/Nest daemon under /opt/obsync-daemon
  - bundled Node runtime
  - production node_modules, including native libsql package
  - drizzle migrations
  - systemd service / launch service
  - default env/config under /etc/obsync-daemon
  - app state under /var/lib/obsync-daemon

Preferred packager:
- Linux: nFPM for deb/rpm
- macOS/Windows: decide later after service model is clearer

Daemon startup:
- service runs Node directly from /opt/obsync-daemon
- CLI talks to daemon over localhost socket/HTTP/named pipe
