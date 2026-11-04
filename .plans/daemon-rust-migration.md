# Rust Daemon Technical Specification (Cheat Sheet)

> **Execution Tracking**: All actionable tasks are tracked in GitHub under [Milestone: Rust Daemon Migration](https://github.com/tetsureign/obsync/milestone/1) ([Issues #1–#7](https://github.com/tetsureign/obsync/issues?q=is%3Aissue+milestone%3A%22Rust+Daemon+Migration%22)).  
> This file is the single-source technical reference for schemas, traits, invariants, and contracts.

---

## 1. Core Invariants & Guardrails

- **Zero CLI changes**: Wire compatibility with `cli/` is mandatory (bearer token in lockfile, localhost HTTP, exact JSON error/response shapes).
- **No `libgit2` for desktop**: Shell out to host `git` using `tokio::process::Command` with `LC_ALL=C`. User SSH keys and credential helpers are inherited from environment.
- **Sync order**: Strict sequence of `pull → stage → commit → push → done`.
- **Per-vault serialization**: Concurrency = 1 per vault in-memory. Different vaults sync concurrently.
- **Runtime Git resolution**: `remote` and `branch` are resolved from git at runtime, never stored in the database.
- **Clean recovery**: On boot, any dangling `queued` or `running` operations are aborted with code `DAEMON_INTERRUPTED`.

---

## 2. Tech Stack Mapping

| Layer | Current (NestJS) | Target (Rust / loco.rs) |
|---|---|---|
| **Framework** | NestJS 11 (Express) | **loco.rs** (Axum) |
| **API Pattern** | CQRS + Controllers + Handlers | **REPR** (Request-Endpoint-Response) |
| **Database** | Drizzle ORM (SQLite) | **SeaORM** (SQLite in WAL mode) |
| **Git Operations** | `simple-git` CLI wrapper | **`trait GitService`** (`CliGitService`) |
| **Queue** | `p-queue` (per-vault) | **Tokio task serializer** (in-memory per-vault) |
| **Realtime** | None | **Axum SSE** (`tokio::sync::broadcast`) |
| **Validation** | Zod / `nestjs-zod` | **`validator` crate** + Serde |
| **Auth** | `TokenGuard` (Bearer token) | **Axum middleware** reading lockfile token |

---

## 3. Database Schema (SQLite via SeaORM)

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
- `files` (TEXT NULL) — JSON array of conflicting file paths
- `strategy` (TEXT NOT NULL) — `'log-and-skip' | 'stash-and-retry'`
- `resolved` (BOOLEAN DEFAULT FALSE)
- `created_at`, `updated_at` (TIMESTAMPS)

---

## 4. Key Trait & Endpoint Contracts

### `trait GitService`
```rust
#[async_trait]
pub trait GitService: Send + Sync {
    async fn status(&self, path: &Path) -> Result<GitStatus, GitError>;
    async fn pull(&self, path: &Path) -> Result<(), GitError>;
    async fn stage(&self, path: &Path, patterns: &[&str]) -> Result<(), GitError>;
    async fn commit(&self, path: &Path, message: &str) -> Result<String, GitError>;
    async fn push(&self, path: &Path) -> Result<(), GitError>;
    async fn diff(&self, path: &Path) -> Result<String, GitError>;
    async fn stash(&self, path: &Path) -> Result<(), GitError>;
    async fn stash_pop(&self, path: &Path) -> Result<(), GitError>;
}
```

### REPR Endpoint Pattern
```rust
// src/endpoints/vaults/create.rs
#[derive(Deserialize, Validate)]
pub struct Request {
    #[validate(length(min = 1))]
    pub name: String,
    pub local_path: String,
}

#[derive(Serialize)]
pub struct Response {
    pub id: String,
    pub name: String,
    pub local_path: String,
    // ...
}

pub async fn handler(
    State(ctx): State<AppContext>,
    Json(payload): Json<Request>,
) -> Result<Json<Response>> {
    // validation -> logic -> response
}
```

### Standard Error Response Format
```json
{
  "statusCode": 404,
  "code": "VAULT_NOT_FOUND",
  "message": "Vault 'my-vault' was not found"
}
```

---

## 5. Target Crate Layout

```text
daemon-rs/
├── config/             # development.yaml, test.yaml, production.yaml
├── migration/          # SeaORM migrations
├── src/
│   ├── app.rs          # App boot, router mounting, middleware
│   ├── initializers/   # lockfile.rs (token + PID), openapi.rs
│   ├── models/         # SeaORM entities (vaults, sync_ops, conflicts)
│   ├── services/
│   │   ├── git/        # trait GitService, cli.rs, mock.rs
│   │   ├── sync_queue.rs # Per-vault concurrency-1 serializer
│   │   └── sync_runner.rs# Step pipeline runner + conflict handling
│   └── endpoints/      # REPR handlers (health, vaults/, sync/)
└── tests/              # Loco boot_test integration suites
```

---

## 6. Future Scope: Mobile (`obsync-core`)

When ready for mobile (Android/iOS):
- Extract sync engine & DB logic into an embeddable library crate (`obsync-core`).
- Provide an `EmbeddedGitService` implementation (`gix` or `git2`) since iOS sandbox forbids `fork`/`exec`.
- Bridge to mobile UI via JSI/FFI TurboModules.
