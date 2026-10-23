# Daemon Migration Plan: Node.js/NestJS → Rust (loco.rs)

## 1. Overview & Motivation

Migrate the obsync daemon from TypeScript/NestJS to Rust using the [loco.rs](https://loco.rs) framework.

### Key Goals
- **Single-binary & Mobile distribution**: Eliminate the Node.js runtime and packaging hacks (`@yao-pkg/pkg`, `node:sqlite` version constraints, heavy `node_modules`). Compile a single lightweight binary (~15MB RAM idle) capable of running on **Desktop (Linux/macOS/Windows)** and **Mobile (Android via Termux)**, with an architectural path to a cross-platform **React Native mobile app (Android & iOS)**.
- **Zero CLI changes (Blackbox Verification)**: Maintain 100% wire-compatibility with the existing Rust `cli/`. The CLI already handles lockfile resolution, bearer tokens, health probing, and error handling—it acts as the automated integration test suite during migration.
- **Architectural simplification**: Retire NestJS's CQRS buses (`CommandBus`/`QueryBus`) and fat controllers in favor of **REPR (Request-Endpoint-Response)** pattern per endpoint.
- **Complete Feature Set in Rust**: Implement **SSE streaming** and the missing **ConflictModule (`stash-and-retry`)** directly in Rust rather than writing them twice.

### Non-Goals / Constraints
- **NO `libgit2` for Desktop/Termux**: Shell out directly to the system `git` CLI using `tokio::process::Command` with `LC_ALL=C`. Authentication (SSH keys, credential helpers) is handled by the user's environment.
- **Keep Localhost HTTP**: Avoid switching to Unix sockets or custom RPC for CLI communication. Localhost HTTP is cross-platform, handles SSE easily, leaves the door open for direct Obsidian community plugin integration (`fetch()`), and preserves all existing client code in `cli/`.

---

## 2. Tech Stack Mapping

| Layer | Current (NestJS) | Target (Rust / loco.rs) |
|---|---|---|
| **Framework** | NestJS 11 (Express platform) | **loco.rs 1.2+** (Axum) |
| **API Pattern** | CQRS + Controllers + Handlers | **REPR** (Request-Endpoint-Response) |
| **Database ORM** | Drizzle ORM (SQLite) | **SeaORM 2.0** (SQLite) |
| **Git Operations** | `simple-git` (CLI wrapper) | **`trait GitService`** (`CliGitService` via `tokio::process::Command`) |
| **Queue / Serialization** | `p-queue` (in-memory per-vault) | **In-memory Tokio task serializer** (or Loco background worker) |
| **Realtime Streaming** | None | **Axum SSE (`tokio::sync::broadcast`)** |
| **Validation** | Zod + `nestjs-zod` | **`validator` crate** + Serde |
| **OpenAPI / Swagger** | `@nestjs/swagger` + `nestjs-zod` | **`loco-openapi`** |
| **Auth** | `TokenGuard` (Bearer token in lockfile) | **Axum middleware / Loco extractor** |
| **Dev Watcher** | NestJS CLI watch mode | **`watchexec`** + **`mold`** linker (<2s rebuilds) |

---

## 3. Core Architectural Decisions

### A. REPR Pattern (Request-Endpoint-Response)
Retire NestJS's CQRS bus indirection. Each HTTP route is a standalone module:

```rust
// src/endpoints/sync/trigger_sync.rs
#[derive(Deserialize, Validate)]
pub struct Request { ... }

#[derive(Serialize)]
pub struct Response { ... }

pub async fn handler(
    State(ctx): State<AppContext>,
    Path(vault_name): Path<String>,
    Json(payload): Json<Request>,
) -> Result<Json<Response>> { ... }
```

### B. Dependency Inversion on `GitService`
Abstract Git operations behind an async trait so the sync engine and endpoints remain agnostic of the underlying Git engine:

```text
               ┌───────────────────────┐
               │    trait GitService   │
               └───────────▲───────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ CliGitService │   │EmbeddedGitSvc │   │  MockGitSvc   │
│ (tokio CLI)   │   │ (gix / git2)  │   │  (in-memory)  │
├───────────────┤   ├───────────────┤   ├───────────────┤
│Desktop/Termux │   │Android / iOS  │   │Instant tests  │
└───────────────┘   └───────────────┘   └───────────────┘
```
- **Phase 1-6 Target**: `CliGitService` shelling out to `git` CLI (zero C dependencies, fast build, works in Termux).
- **Mobile Target (Android & iOS)**: `EmbeddedGitService` (statically linked; mandatory on iOS where `posix_spawn`/`fork` is blocked by kernel sandbox).

### C. Live Realtime Progress (SSE)
Expose `GET /vaults/:name/events` using Axum's native `Sse` response backed by `tokio::sync::broadcast`. `SyncJobRunner` publishes lifecycle events (`pulling`, `staging`, `committing`, `pushing`, `conflict`, `done`), enabling live CLI spinners and TUI views.

### D. Mobile Strategy: React Native UI + Embedded Rust Core
For mobile, the Rust sync engine is compiled as a static/dynamic library and consumed by a **React Native** application:

1. **Native Bridge**:
   - Rust core compiled for `aarch64-linux-android` (`.so`) and `aarch64-apple-ios` (`.a` / XCFramework).
   - Bridged to React Native via **JSI / Cxx TurboModules** (or UniFFI) for direct zero-overhead async function invocation without local TCP sockets.

2. **iOS Platform Rules**:
   - **Embedded Git is Mandatory**: iOS sandbox forbids external process execution (`fork`/`exec` blocked by kernel). `EmbeddedGitService` (`gix` or `git2`) runs completely in-process.
   - **Lifecycle & Backgrounding**: iOS kills idle background processes after ~30s. Sync runs on:
     - Foreground app launch / focus.
     - iOS Background Tasks (`BGAppRefreshTask`).
     - **iOS Shortcuts / Automations** (e.g. trigger sync automatically when Obsidian closes).
   - **Filesystem Access**: Access to the Obsidian vault in the iOS Files app / iCloud Drive is granted via `UIDocumentPickerViewController` and persisted via **Security-Scoped Bookmarks**.

3. **Android Platform Rules**:
   - **Storage Access**: Uses `MANAGE_EXTERNAL_STORAGE` permission to read/write external Obsidian vault directories.
   - **Background Execution**: Runs sync via an Android **Foreground Service** with a persistent notification to prevent aggressive OS battery killers from terminating sync mid-push.

---

## 4. Architecture Blueprint

```text
daemon-rs/
├── Cargo.toml
├── config/
│   ├── development.yaml
│   ├── test.yaml
│   └── production.yaml
├── migration/              # SeaORM migrations
├── src/
│   ├── app.rs              # App lifecycle, router mounting, middleware
│   ├── initializers/
│   │   ├── lockfile.rs     # Boot: generate bearer token, write obsyncd.lock
│   │   └── openapi.rs      # loco-openapi registration
│   ├── models/             # SeaORM entities
│   │   ├── vaults.rs
│   │   ├── sync_operations.rs
│   │   └── conflict_records.rs
│   ├── services/
│   │   ├── git/
│   │   │   ├── mod.rs      # trait GitService
│   │   │   ├── cli.rs      # CliGitService (tokio::process::Command)
│   │   │   └── mock.rs     # MockGitService (for unit tests)
│   │   ├── sync_queue.rs   # Per-vault concurrency-1 serializer
│   │   ├── sync_runner.rs  # Step pipeline + conflict resolution
│   │   └── event_bus.rs    # Broadcast channels for SSE
│   └── endpoints/          # REPR modules
│       ├── health.rs
│       ├── vaults/
│       │   ├── list.rs
│       │   ├── create.rs
│       │   ├── get_by_name.rs
│       │   ├── get_by_path.rs
│       │   ├── update.rs
│       │   └── delete.rs
│       └── sync/
│           ├── trigger_sync.rs
│           ├── abort.rs
│           ├── status.rs
│           ├── history.rs
│           ├── events.rs      # SSE stream
│           └── git_actions.rs # pull, stage, commit, push, diff, status
└── tests/                  # Integration & e2e tests
```

---

## 5. Database Schema (SQLite via SeaORM)

1. **`vaults`**
   - `id` (TEXT PK, UUID)
   - `name` (TEXT UNIQUE NOT NULL)
   - `local_path` (TEXT UNIQUE NOT NULL)
   - `is_dirty` (BOOLEAN DEFAULT FALSE)
   - `auto_sync` (BOOLEAN DEFAULT FALSE)
   - `sync_interval` (INTEGER DEFAULT 300)
   - `conflict_strategy` (TEXT DEFAULT 'log-and-skip')
   - `last_synced_at` (TIMESTAMP NULL)
   - `created_at`, `updated_at` (TIMESTAMPS)

2. **`sync_operations`**
   - `id` (TEXT PK, UUID)
   - `vault_id` (TEXT FK → vaults.id CASCADE)
   - `status` (TEXT: queued, running, success, failed, aborted)
   - `step` (TEXT: pull, stage, commit, push, done)
   - `error` (TEXT NULL)
   - `commit_sha` (TEXT NULL)
   - `started_at` (TIMESTAMP NOT NULL)
   - `created_at`, `updated_at` (TIMESTAMPS)
   - **Partial unique index**: `WHERE status IN ('queued', 'running')` on `vault_id` (enforces at most one active sync per vault at the DB level).

3. **`conflict_records`**
   - `id` (TEXT PK, UUID)
   - `vault_id` (TEXT FK → vaults.id CASCADE)
   - `files` (TEXT / JSON array)
   - `strategy` (TEXT: log-and-skip, stash-and-retry)
   - `resolved` (BOOLEAN DEFAULT FALSE)
   - `created_at`, `updated_at` (TIMESTAMPS)

---

## 6. Implementation Roadmap

### Phase 0: Scaffolding & Tooling (0.5 days)
- [ ] Initialize Loco app (`cargo loco new` in `daemon-rs/` or workspace).
- [ ] Configure SQLite with WAL mode and foreign keys enabled.
- [ ] Setup fast dev loop:
  - Add `mold` linker configuration to `.cargo/config.toml`.
  - Add watch script: `watchexec -r -e rs,yaml -- cargo run`.
- [ ] Implement lockfile & token auth middleware:
  - Generate 32-byte hex token at startup.
  - Write lockfile (`~/.local/share/obsync/obsyncd.lock`) with `{ token, pid, port }`.
  - Clean up lockfile on shutdown hooks (SIGINT/SIGTERM).
  - Axum extractor/middleware validating `Authorization: Bearer <token>`.

### Phase 1: Database Migrations & SeaORM Entities (0.5 days)
- [ ] Write SeaORM migrations for `vaults`, `sync_operations`, and `conflict_records`.
- [ ] Add raw SQL migration for the partial unique index on `sync_operations` (`status IN ('queued', 'running')`).
- [ ] Ensure automatic migration execution on boot.
- [ ] Generate SeaORM entity models.

### Phase 2: Git Service Abstraction (1 day)
- [ ] Define `trait GitService` with async methods: `pull`, `stage`, `commit`, `push`, `status`, `diff`, `stash`, `stash_pop`.
- [ ] Implement `CliGitService` wrapping `tokio::process::Command`:
  - Force `LC_ALL=C` for uniform error parsing.
  - Implement porcelain output parser for status & branch resolution.
  - Typed error mapping (`MergeConflict`, `RemoteAuth`, `NetworkError`, `DirtyWorkingTree`, `NotAGitRepo`).
- [ ] Implement `MockGitService` for instant in-memory unit testing.

### Phase 3: Vault CRUD Endpoints (REPR) (1 day)
- [ ] `GET /vaults` — list all registered vaults
- [ ] `POST /vaults` — register vault (validates local git repo)
- [ ] `GET /vaults/by-path` — lookup vault by local filesystem path
- [ ] `GET /vaults/:name` — get vault configuration & status
- [ ] `PATCH /vaults/:name` — update settings (interval, auto_sync, conflict_strategy)
- [ ] `DELETE /vaults/:name` — unregister vault (guards against active syncs)
- [ ] Standardize error JSON formatting matching current `AppError` contract.

### Phase 4: Sync Engine & ConflictModule (1.5 days)
- [ ] Implement in-memory per-vault task serialization (concurrency = 1 per vault, parallel across vaults).
- [ ] Implement `SyncJobRunner`:
  - Pipeline: `pull → stage → commit → push → done`.
  - Step updates with best-effort DB persistence retry.
  - **ConflictModule**:
    - `log-and-skip`: Record conflict files in `conflict_records`, mark failed, exit cleanly.
    - `stash-and-retry`: Stash local changes, pull upstream, pop stash, check for merge conflicts.
- [ ] Implement daemon startup recovery:
  - Abort any leftover `queued` or `running` rows on boot.

### Phase 5: Sync Endpoints, SSE & OpenAPI (1 day)
- [ ] `POST /vaults/:name/sync` — enqueue sync run
- [ ] `POST /vaults/:name/abort` — abort active or queued run
- [ ] `GET /vaults/:name/status` — active op + runtime queue status
- [ ] `GET /vaults/:name/syncs` — sync history
- [ ] `GET /vaults/:name/events` — **SSE endpoint** streaming real-time sync steps
- [ ] Granular git endpoints (`git-status`, `git-diff`, `git-pull`, `git-stage`, `git-commit`, `git-push`).
- [ ] Wire up `loco-openapi` for Swagger UI.

### Phase 6: Verification, CLI Integration & Termux Build (1.5 days)
- [ ] Port the 8 e2e spec suites to Loco's integration testing harness (`boot_test`).
- [ ] Run the **existing Rust CLI** against the running Loco daemon to verify full wire parity.
- [ ] Cross-compile for Android Termux:
  ```bash
  cargo build --target aarch64-linux-android --release
  ```
- [ ] Verify execution inside Termux with a local git repo.

### Phase 7: Mobile Path — React Native App (Android & iOS) (Future Scope)
- [ ] Extract the Rust sync engine into an embeddable library crate (`obsync-core`).
- [ ] Implement `EmbeddedGitService` using `gix` or `git2`.
- [ ] Setup React Native mobile project (TypeScript + React Native New Architecture).
- [ ] Build native bridge:
  - JSI / Cxx TurboModules linking the Rust `.a` / `.so` libraries.
- [ ] Platform-specific native hooks:
  - **iOS**: Security-scoped bookmarks for Files app folder access, `BGAppRefreshTask`, iOS Shortcut intents.
  - **Android**: `MANAGE_EXTERNAL_STORAGE` permission, Android Foreground Service with ongoing notification.
- [ ] Build minimalist mobile sync UI (vault selection, manual sync trigger, sync log viewer, conflict diff resolution).

---

## 7. Timeline & Risk Summary

- **Total Estimated Effort**: ~8–10 working days
- **Risk Level**: **Low**. The domain logic is small (~3.1k LOC), wire contracts are preserved, and the existing Rust CLI acts as an immutable verification harness.
