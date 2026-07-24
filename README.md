# obsync

> **Pre-release** — core sync is functional but the project is under active development. See [Status](#status) for what works today.

A self-hosted Obsidian vault sync tool built on Git. Run it entirely on your own machine — no cloud accounts, no proprietary servers.

obsync is a two-process system: a long-running **daemon** (NestJS) owns all Git operations, scheduling, and state; a thin **CLI** (Rust) is the control interface.

---

## How it works

```
┌─────────────────────┐
│   CLI  (Rust)       │  obsync vault add / sync / status / log …
└──────────┬──────────┘
           │  HTTP  (localhost)
┌──────────▼──────────┐
│   Daemon  (NestJS)  │  Git · SQLite · sync queue · conflict log
└─────────────────────┘
           │
    your vault (local filesystem + Git remote)
```

The daemon runs in the background and handles everything: pulling, staging, committing, pushing, and conflict detection. The CLI sends commands and renders responses — it has no Git logic of its own.

---

## Status

| Feature                                        | State                                                |
| ---------------------------------------------- | ---------------------------------------------------- |
| Vault registration (`vault add`, `vault list`) | ✅ Working                                           |
| Manual sync (`sync`)                           | ✅ Working                                           |
| Sync history & status                          | ✅ Working                                           |
| Conflict detection & logging                   | 🟡 Detected, not yet recorded to DB                  |
| Auth between CLI and daemon                    | ❌ Not yet — daemon is localhost-only, no token auth |
| Auto-sync (file watcher)                       | ❌ Post-MVP                                          |
| Live event stream (`obsync watch`)             | ❌ Post-MVP                                          |
| Config export / import (TOML)                  | ❌ Post-MVP                                          |
| Daemon service installer                       | ❌ Post-MVP                                          |

Full roadmap: [`.plans/ROADMAP.md`](.plans/ROADMAP.md)

---

## Requirements

- **Node.js** 26+ (for the daemon, using Temporal API)
- **Rust** + Cargo (to build the CLI)
- **Git** installed and configured (SSH keys / credential helper set up — obsync uses your system credential store)

---

## Getting started

### 1. Start the daemon

```sh
cd daemon
pnpm install
pnpm run db:migrate   # run Drizzle migrations once
pnpm run start:dev    # starts on http://127.0.0.1:3000
```

> ⚠️ The daemon currently binds to a fixed port (`PORT` env var, default `3000`) and has no authentication. Keep it on localhost. See [SECURITY.md](SECURITY.md) for details.

### 2. Build the CLI

```sh
cd cli
cargo build --release
# binary at cli/target/release/obsync
```

Or run without building:

```sh
cargo run -- <command>
```

### 3. Register a vault

Your vault directory must already be a Git repository with a configured remote (`origin`).

```sh
obsync vault add /path/to/your/vault
# or with an explicit name:
obsync vault add /path/to/your/vault --name work
```

### 4. Sync

```sh
obsync sync <vault-id>
```

### 5. Check status and history

```sh
obsync vault list
```

---

## CLI reference

```
obsync vault add <path> [--name <name>]   register a vault (must be a git repo with a remote)
obsync vault list                         list registered vaults
obsync sync <vault-id>                    run a manual sync (pull → stage → commit → push)
```

> ⚠️ `remove`, `status`, `log`, and `watch` are not yet wired in the CLI. The daemon endpoints exist — CLI commands are tracked in [ROADMAP.md Phase 3](.plans/ROADMAP.md).

---

## Project layout

```
obsync/
├── daemon/          NestJS daemon (TypeScript)
│   ├── src/
│   │   ├── vault/       vault registry (CQRS)
│   │   ├── sync/        sync pipeline, job runner, history
│   │   ├── git/         simple-git wrapper + error mapping
│   │   ├── sync-queue/  per-vault p-queue (concurrency 1)
│   │   ├── database/    Drizzle ORM + SQLite
│   │   └── common/      errors, filters, utils
│   └── test/        integration tests (supertest)
├── cli/             Rust CLI
│   └── src/
│       ├── main.rs      clap commands
│       └── client.rs    reqwest HTTP client
└── .plans/          design documents and roadmap
```

---

## Development

### Daemon

```sh
cd daemon
pnpm install
pnpm run start:dev      # watch mode
pnpm run test:e2e       # integration tests
```

Swagger UI is available at `http://127.0.0.1:3000/api` in dev mode.

### CLI

```sh
cd cli
cargo run -- vault list
cargo run -- sync <vault-id>
```

### Database

```sh
cd daemon
pnpm run db:generate    # generate migrations from schema changes
pnpm run db:migrate     # apply migrations
pnpm run db:studio      # Drizzle Studio UI
```

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed breakdown of the system design, module structure, data model, and API surface.

## Security

See [SECURITY.md](SECURITY.md) for the threat model, designed security controls, and current pre-release security status.
