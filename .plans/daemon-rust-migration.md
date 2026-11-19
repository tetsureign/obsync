# Rust Daemon Technical Specification (Cheat Sheet)

> **Execution Tracking**: All actionable tasks are tracked in GitHub under [Milestone: Rust Daemon Migration](https://github.com/tetsureign/obsync/milestone/1) ([Issues #1–#7](https://github.com/tetsureign/obsync/issues?q=is%3Aissue+milestone%3A%22Rust+Daemon+Migration%22)).  
> This file is the single-source technical reference for schemas, traits, invariants, and contracts.

---

## 1. Core Invariants & Guardrails

- **Stable, versioned public API**: Localhost HTTP on `127.0.0.1` with bearer token from the `daemon.json` lockfile is the public contract for all clients (CLI, Obsidian plugins, status bars, scripts). The CLI is updated **in lockstep** (it moves to `obsync-common` anyway) rather than freezing today's shapes. Expose an `apiVersion` in `/health` and the lockfile so external clients can check compatibility.
- **Secure lockfile**: Write `daemon.json` atomically (temp file + rename) with `0600` permissions — never world-readable (current TS writes default `0644`).
- **No `libgit2` for desktop**: Shell out to host `git` using `tokio::process::Command` with `LC_ALL=C`. User SSH keys and credential helpers are inherited from the environment.
- **Sync order**: Strict sequence of `pull → stage → commit → push → done`.
- **Per-vault serialization**: Concurrency = 1 per vault in-memory. Different vaults sync concurrently.
- **Runtime Git resolution**: `remote` and `branch` are resolved from git at runtime, never stored in the database.
- **Clean recovery**: On boot, any dangling `queued` or `running` operations are aborted with code `DAEMON_INTERRUPTED`.
- **Shared workspace contract (`obsync-common`)**: Deduplicate `paths.rs`, `lockfile.rs`, wire DTOs, and `ApiErrorPayload` between `cli/` and `daemon/` via a lightweight `common/` workspace crate (`serde`-only, no DB or HTTP dependencies).
- **Transport-agnostic engine boundary**: `daemon/src/engine` must never import `axum` or HTTP types, and `Database` must accept an explicit `&Path` injected at startup rather than reading global path constants internally.
- **Module file convention**: Use modern `foo.rs` + `foo/` module layout across the workspace (no `mod.rs`), enforced via `[workspace.lints.clippy] mod_module_files = "deny"`.

---

## 2. Tech Stack Mapping

| Layer | Current (NestJS) | Target (Rust) |
|---|---|---|
| **Framework** | NestJS 11 (Express) | **Axum** (`axum` + `tower-http`) |
| **API Pattern** | CQRS + Controllers + Handlers | **REPR** (Request-Endpoint-Response) |
| **Database** | Drizzle ORM (SQLite) | **SQLx** with SQLite (`WAL`, `foreign_keys = ON`, `busy_timeout`) + embedded SQL migrations (`sqlx::migrate!`). Compile-time macros require a committed `.sqlx/` offline cache (`cargo sqlx prepare`) for CI |
| **Shared Wire & Config** | Duplicated TS/Rust (`app-paths.ts`, DTOs) | **`obsync-common`** workspace crate (`serde`, `paths.rs`, `lockfile.rs`, DTOs, error codes) |
| **Errors** | 25+ `AppError` subclasses + exception filter | **`thiserror`** domain enums (`engine/error.rs`) → `IntoResponse` (`http/error.rs` → `ApiErrorPayload`) |
| **Git Operations** | `simple-git` CLI wrapper | **`trait GitService`** (`CliGitService`) |
| **Queue** | `p-queue` (per-vault) | **Tokio task serializer** (in-memory per-vault) |
| **Realtime** | None | **Axum SSE** (`tokio::sync::broadcast`) |
| **Validation** | Zod / `nestjs-zod` | Serde for shape; domain validation in `engine` (`TryFrom` / constructors) — no `validator` derives on `common` DTOs, so mobile gets validation for free |
| **Auth** | `TokenGuard` (Bearer token) | **Axum middleware** reading lockfile token (header), plus `?token=` (or short-lived ticket) accepted **only** on SSE routes since `EventSource` can't set headers |
| **CORS** | `origin: '127.0.0.1'` (invalid origin) | `tower-http` CORS allowing `app://obsidian.md` (Obsidian desktop) |

---

## 3. Database Schema (SQLite)

### Table: `vaults`
- `id` (TEXT PK, UUID)
- `name` (TEXT UNIQUE NOT NULL)
- `local_path` (TEXT UNIQUE NOT NULL)
- `is_dirty` (BOOLEAN DEFAULT FALSE)
- `auto_sync` (BOOLEAN DEFAULT FALSE)
- `sync_interval` (INTEGER DEFAULT 300)
- `conflict_strategy` (TEXT DEFAULT 'log-and-skip') — `'log-and-skip' | 'stash-and-retry'`
- `last_synced_at` (TIMESTAMP NULL)
- `created_at`, `updated_at` (TIMESTAMPS)

### Table: `sync_operations`
- `id` (TEXT PK, UUID)
- `vault_id` (TEXT FK → vaults.id CASCADE)
- `status` (TEXT NOT NULL) — `'queued' | 'running' | 'success' | 'failed' | 'aborted'`
- `step` (TEXT NOT NULL) — `'pull' | 'stage' | 'commit' | 'push' | 'done'`
- `error` (TEXT NULL)
- `commit_sha` (TEXT NULL)
- `started_at` (TIMESTAMP NOT NULL)
- `created_at`, `updated_at` (TIMESTAMPS)
- **Partial Unique Index**:
  ```sql
  CREATE UNIQUE INDEX sync_operations_one_active_per_vault
  ON sync_operations(vault_id)
  WHERE status IN ('queued', 'running');
  ```

### Table: `conflict_records`
- `id` (TEXT PK, UUID)
- `vault_id` (TEXT FK → vaults.id CASCADE)
- `files` (TEXT NOT NULL) — JSON array of conflicting file paths
- `strategy` (TEXT NOT NULL) — `'log-and-skip' | 'stash-and-retry'`
- `resolved` (BOOLEAN DEFAULT FALSE)
- `created_at`, `updated_at` (TIMESTAMPS)

### Migrating existing installs
- Existing users have a Drizzle-managed `obsync.db` (tracked in `__drizzle_migrations`). The first SQLx migration is a **baseline** that detects the existing schema (e.g. `vaults` table present) and adopts it instead of re-creating tables.
- Timestamps are stored as **unix seconds** (`INTEGER`) in the DB and serialized as **ISO-8601 strings** on the wire — keep both conventions.

---

## 4. Key Trait & Endpoint Contracts

### `trait GitService`
```rust
#[async_trait]
pub trait GitService: Send + Sync {
    async fn validate_vault_git_repo(&self, path: &Path) -> Result<(), GitError>;
    async fn inspect_existing_vault(&self, path: &Path) -> Result<VaultGitInfo, GitError>;
    async fn get_effective_remote(
        &self,
        path: &Path,
        remote_alias: Option<&str>,
    ) -> Result<String, GitError>; // RemoteNotFound error if missing
    async fn get_effective_branch(&self, path: &Path) -> Result<String, GitError>;
    async fn status(&self, path: &Path) -> Result<GitStatus, GitError>;
    async fn pull(&self, path: &Path) -> Result<(), GitError>;
    async fn stage(&self, path: &Path, patterns: &[&str]) -> Result<(), GitError>;
    async fn commit(&self, path: &Path, message: &str) -> Result<Option<String>, GitError>; // None = nothing committed
    async fn push(&self, path: &Path) -> Result<(), GitError>;
    async fn diff(&self, path: &Path, options: Option<&[&str]>) -> Result<String, GitError>;
    async fn stash(&self, path: &Path) -> Result<(), GitError>;
    async fn stash_pop(&self, path: &Path) -> Result<(), GitError>;
}
```

### REPR Endpoint Pattern (Plain Axum + `obsync-common` DTOs)
```rust
// daemon/src/http/routes/vaults.rs
use axum::{extract::State, Json};
use obsync_common::dto::vault::{CreateVaultRequest, Vault};

pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateVaultRequest>,
) -> Result<Json<Vault>, HttpError> {
    // validation -> engine vault service -> response
}
```

### Standard Error Response Format
```json
{
  "statusCode": 404,
  "code": "VAULT_NOT_FOUND",
  "message": "Vault 'my-vault' was not found",
  "timestamp": "2026-11-19T07:00:00Z",
  "path": "/vaults/my-vault",
  "details": null
}
```

### Status response cleanup (breaking, do it now)
Current `GET /vaults/:name/status` leaks `p-queue` internals and has a misleading name:
- `activeOperations` (single object) → rename to `activeOperation`.
- `runtime.runningTasks` (`{priority, startTime, timeout}`) → replace with domain fields (e.g. `queuedCount`, `running: bool`, current `step`).

Change it before any external client depends on it; update the CLI in the same change.

---

## 5. Target Workspace & Crate Layout

Using a 3-crate Cargo workspace (`common`, `cli`, `daemon`) with the modern `foo.rs` + `foo/` module layout (no `mod.rs`), enforced in the root `Cargo.toml`:

```toml
[workspace]
members = ["common", "cli", "daemon"]
resolver = "2"

[workspace.lints.clippy]
mod_module_files = "deny"
```

```text
obsync/
├── Cargo.toml                  # Workspace root + clippy `mod_module_files = "deny"`
│
├── common/                     # Crate: `obsync-common` (serde-only, no DB/HTTP)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── paths.rs            # Platform data dirs (moved from cli/src/paths.rs)
│       ├── lockfile.rs         # Read/write + PID liveness check for daemon.json
│       ├── error.rs            # ApiErrorPayload + canonical error code constants
│       ├── dto.rs              # Shared wire structs
│       └── dto/
│           ├── vault.rs        # Vault, CreateVaultRequest, EditVaultRequest
│           └── sync.rs         # SyncOperation, SyncStatusResponse, SyncEvent (SSE)
│
├── cli/                        # Crate: `obsync` (depends on `obsync-common`)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── cli.rs
│       ├── output.rs
│       ├── utils.rs
│       ├── client.rs           # Uses `obsync_common::dto::*` & `ApiErrorPayload`
│       ├── client/
│       │   └── error.rs
│       ├── commands.rs
│       └── commands/
│           ├── vault.rs
│           └── sync.rs
│
└── daemon/                     # Crate: `obsyncd`
    ├── Cargo.toml              # axum, tower-http, tokio, sqlx, thiserror
    ├── migrations/             # SQLite SQL migrations (embedded at compile time)
    ├── src/
    │   ├── main.rs             # Pre-boot health/lockfile probe -> DB connect(&Path) -> Axum bind
    │   ├── lib.rs              # Exports `engine` and `http` for integration tests
    │   │
    │   ├── engine.rs           # PORTABLE CORE (No Axum/HTTP imports — mobile-ready)
    │   ├── engine/
    │   │   ├── error.rs        # Domain `AppError` enum (`GitError`, `VaultError`, `SyncError`)
    │   │   ├── db.rs           # SQLite pool init taking `&Path` (WAL, foreign_keys, busy_timeout)
    │   │   ├── conflict.rs     # conflict_records persistence
    │   │   ├── git.rs          # `trait GitService` + `GitStatus` / `VaultGitInfo`
    │   │   ├── git/
    │   │   │   └── cli.rs      # `CliGitService` (`tokio::process::Command` with LC_ALL=C)
    │   │   ├── vault.rs        # VaultService (create / update / delete / inspect)
    │   │   ├── vault/
    │   │   │   └── repo.rs     # Vault SQLite queries
    │   │   ├── sync.rs         # SyncService (orchestrates queue + runner + status/history/diff)
    │   │   └── sync/
    │   │       ├── queue.rs    # Per-vault concurrency=1 serializer + abort support
    │   │       ├── runner.rs   # `pull -> stage -> commit -> push` + retry + conflict log
    │   │       └── repo.rs     # sync_operations SQLite state transitions
    │   │
    │   ├── http.rs             # DESKTOP TRANSPORT LAYER (Router builder + AppState)
    │   └── http/
    │       ├── auth.rs         # Bearer token middleware
    │       ├── error.rs        # `impl IntoResponse for AppError` -> `ApiErrorPayload`
    │       ├── routes.rs
    │       └── routes/
    │           ├── health.rs   # GET /health
    │           ├── vaults.rs   # GET/POST /vaults, GET/PATCH/DELETE /vaults/:name
    │           ├── sync.rs     # POST /vaults/:name/{sync,pull,stage,commit,push,abort}, GET status/history/diff
    │           └── events.rs   # GET /vaults/:name/events (SSE broadcast stream)
    │
    └── tests/                  # E2E tests against real temp SQLite + bare Git repos
        ├── vault_e2e.rs
        └── sync_e2e.rs
```

---

## 6. Cutover & Verification

- **Contract tests**: Reuse the existing Vitest e2e suite (`daemon/test/{vault,sync,common}`) as black-box contract tests. Change `test/helpers/test-app.ts` (`createE2eApp`) to spawn a daemon binary and target its URL instead of booting Nest in-process. Run the same suite against both Node and Rust daemons until the Rust one passes; then port to Rust `tests/` and remove the TS daemon.
- **Update `AGENTS.md`** after cutover: replace pnpm/Drizzle/Zod rules and verification commands with Cargo workspace equivalents (`cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo sqlx prepare --check`).

---

## 7. Future Scope: Mobile (`obsync-core`)

Desktop (CLI + localhost HTTP/SSE for Obsidian plugins and desktop integrations) is the current focus; mobile support is not planned right now. Keeping the `daemon/src/engine/` boundary cleanly isolated makes mobile a drop-in extension later without rewriting the sync engine or DB layer:

- Extract `daemon/src/engine` into a standalone `obsync-core` library crate.
- Provide an `EmbeddedGitService` implementation (`git2` or `gix` with explicit SSH key / PAT callbacks) implementing `trait GitService`, since iOS/mobile sandboxes forbid `fork`/`exec`.
- Inject the mobile app container's `data_dir` path into `db::connect(&Path)` from the host runtime.
- Expose `engine` services to Swift/Kotlin/JS via UniFFI / FFI instead of `http/`.
