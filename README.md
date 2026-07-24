# obsync

A self-hosted Obsidian vault sync tool built on Git. Run it entirely on your own machine — no cloud accounts, no proprietary servers, no surprise pricing changes.

obsync automates the Git workflow behind a **two-process architecture**: a long-running **daemon** (NestJS) owns all sync intelligence, scheduling, and state; a thin **CLI** (Rust) is the control interface. The daemon stays alive when your terminal closes. The CLI starts instantly and weighs nothing.

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

This separation keeps the sync queue running even when the terminal is closed, and lets multiple CLI invocations (or other HTTP clients) query the daemon simultaneously, while the CLI stays fast and lean with instantaneous cold start.

> **See [ARCHITECTURE.md](ARCHITECTURE.md)** for the full system design: CQRS module structure, sync state machine, database schema, and API surface.  
> **See [SECURITY.md](SECURITY.md)** for the threat model and phased hardening plan.

---

## Why Git?

Because you already own it. Git gives you history, branching, conflict resolution, and any remote you want — GitHub, GitLab, a private Gitea instance, or a bare repo on a Raspberry Pi. obsync just removes the friction of running `pull → stage → commit → push` manually every time you switch devices.

---

## What it does today

- **Vault registration** — point obsync at any Git-backed Obsidian vault
- **Manual sync** — one command runs the full pull-stage-commit-push pipeline
- **Sync history & status** — per-vault operation log and current state
- **Conflict detection** — identifies merge conflicts and surfaces them for resolution
- **Crash-safe startup** — detects and cleans up dangling sync operations left by a previous daemon crash, keeping the database consistent

The sync pipeline is backed by a SQLite database with a state machine that tracks every operation from queue to completion. A partial unique index enforces at most one active sync per vault at the database level.

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

## Status

obsync is under active development. Core sync is functional and tested. See [`.plans/ROADMAP.md`](.plans/ROADMAP.md) for upcoming features

> Security note: The daemon currently binds to localhost only with no authentication. Do not expose the port to a network interface. See [SECURITY.md](SECURITY.md) for the full threat model and planned hardening phases.
