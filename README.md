# obsync

A self-hosted Obsidian vault sync tool built on Git. Run it entirely on your own machine — no cloud accounts, no proprietary servers, no surprise pricing changes.

obsync automates the Git workflow behind a **two-process architecture**: a long-running **daemon** (NestJS) owns all sync intelligence, queueing, and state; a thin **CLI** (Rust) is the control interface. The daemon stays alive when your terminal closes. The CLI starts instantly and weighs nothing.

---

## How it works

obsync has two processes: a long-running daemon and a thin CLI. The CLI interfaces with the daemon over authenticated HTTP on localhost; the daemon owns vault files, Git operations, sync state, and communication with the Git remote, while the CLI only sends commands and renders responses.

> **See [ARCHITECTURE.md](ARCHITECTURE.md)** for the system design and engineering decisions.
>
> **See [SECURITY_MODEL.md](SECURITY_MODEL.md)** for the security decisions and trust boundaries.
>
> **See [SECURITY.md](SECURITY.md)** to report a vulnerability.

---

## Why Git?

Because you already own it. Git gives you history, branching, conflict resolution, and any remote you want — GitHub, GitLab, a private Gitea instance, or a bare repo on a Raspberry Pi. obsync just removes the friction of running `pull → stage → commit → push` manually every time you switch devices.

---

## Features

### Available now

- **Vault registration** — point obsync at any Git-backed Obsidian vault
- **Manual sync** — one command runs the full pull-stage-commit-push pipeline
- **Per-vault queueing** — sync jobs are serialized per vault while different vaults can run independently
- **Sync history & status** — per-vault operation log and current state
- **Conflict detection** — records merge conflicts for later resolution
- **Local session authentication** — the daemon issues a per-session token that the CLI discovers automatically
- **Crash-safe startup** — detects and cleans up dangling sync operations left by a previous daemon crash, keeping the database consistent

The sync pipeline is backed by a SQLite database with a state machine that tracks every operation from queue to completion. A partial unique index enforces at most one active sync per vault at the database level.

### Planned post-MVP

- **Conflict resolution** — resolve recorded merge conflicts and complete the `stash-and-retry` workflow
- **Automatic sync** — add file watching and scheduling for configured vaults
- **Configuration files** — export and import vault configuration for backup and migration
- **Guided vault setup** — recommend a suitable `.gitignore` and guide Git/remote setup before registration
- **Live status streaming** — stream sync progress and daemon events to connected clients
- **Terminal UI** — provide an interactive interface for monitoring and managing vaults

---

## Requirements

- **Git** installed and configured (SSH keys / credential helper set up — obsync uses your system credential store)

For building from source additionally: **Node.js** 26+, **pnpm** (daemon), and **Rust** + Cargo (CLI).

---

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/tetsureign/obsync/master/install.sh | sh
```

Installs the `obsync` CLI and `obsyncd` daemon into `~/.local/bin`, registers a
background service (systemd user unit on Linux, LaunchAgent on macOS), and is
safe to re-run to update. See `install.sh --help` for options.

---

## Getting started

### 1. Start the daemon (from source)

```sh
cd daemon
pnpm install
pnpm run db:migrate   # run Drizzle migrations once
pnpm run start:dev    # starts by default on http://127.0.0.1:7274
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

Before the first commit, create a `.gitignore` in the vault root and decide
which Obsidian settings should be shared between devices. A common starting
point is to ignore per-device workspace state:

```gitignore
.obsidian/workspace.json
.obsidian/workspaces.json
.obsidian/workspace-mobile.json
```

If settings, themes, and plugins should stay device-specific, ignore the whole
`.obsidian/` directory instead. These are alternatives: keep the parts of
`.obsidian/` you want to version. Obsidian’s [data-storage guide](https://obsidian.md/help/data-storage)
and [Git documentation](https://publish.obsidian.md/git-doc/Tips-and-Tricks)
explain the tradeoffs and additional patterns.

```sh
obsync vault add /path/to/your/vault
# or with an explicit name:
obsync vault add /path/to/your/vault --name work
```

### 4. Sync

```sh
obsync sync <vault-name>
```

### 5. Check status and recent history

```sh
obsync sync status <vault-name>
```

The daemon writes a per-session lockfile containing its bearer token, PID, and
port. The CLI reads it automatically. See [SECURITY_MODEL.md](SECURITY_MODEL.md)
for the lockfile lifecycle and default locations. Use `--daemon-url` or
`OBSYNC_DAEMON_URL` only when the daemon is reachable at a different local URL.

---

## CLI reference

```
obsync vault add <path> [options]         register a vault (must be a git repo with a remote)
obsync vault list                         list registered vaults
obsync vault info <name>                  show a vault
obsync vault edit <name> [options]        update a vault
obsync vault delete <name>                delete a vault registration
obsync sync <name> [options]              run pull → stage → commit → push
obsync sync status <name>                 show current and recent sync operations
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

Swagger UI is available at `http://127.0.0.1:7274/api` in dev mode by default.

### CLI

```sh
cd cli
cargo run -- vault list
cargo run -- sync <vault-name>
cargo run -- sync status <vault-name>
```

### Database

```sh
cd daemon
pnpm run db:generate    # generate migrations from schema changes
pnpm run db:migrate     # apply migrations
pnpm run db:studio      # Drizzle Studio UI
```

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system structure and engineering decisions
- [SECURITY_MODEL.md](SECURITY_MODEL.md) — security design and limitations
- [SECURITY.md](SECURITY.md) — vulnerability reporting

> Security note: The daemon binds to localhost and requires a per-session Bearer token from its lockfile. Keep the port local: anyone who can read the lockfile can access the daemon. See [SECURITY_MODEL.md](SECURITY_MODEL.md) for details.
