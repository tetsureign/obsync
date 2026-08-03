# AGENTS.md

## Purpose

obsync is a self-hosted Obsidian vault synchronization tool built on Git.

It consists of:

- `daemon/`: persistent NestJS/TypeScript service that owns Git operations,
  synchronization, persistence, queues, and the HTTP API.
- `cli/`: lightweight Rust client that sends HTTP requests to the daemon and
  renders responses.

The CLI must remain a presentation/client layer. It must not contain Git or
synchronization logic.

## Architecture

The main flow is:

`CLI → localhost HTTP API → daemon → local vault/Git remote`

## Important invariants

- All Git operations go through `GitService`.
- A normal sync runs:

  `pull → stage → commit → push`

- Sync jobs are serialized per vault; do not bypass `SyncQueue`.
- Active sync operations are represented by `queued` or `running` database rows.
- `remote` and `branch` are resolved from the repository at runtime. They are
  not persisted in the `vaults` table.
- API route parameters currently use vault names, for example
  `/vaults/:name/sync`. Some older documentation refers to vault IDs; follow the
  current implementation and tests.
- Daemon input/output validation uses Zod and `nestjs-zod`.
- Domain failures should use typed `AppError` subclasses so the global exception
  filter can preserve stable error codes and HTTP statuses.
- Database schema changes require a Drizzle migration.

## Planning guidance

For planning tasks:

1. Start from the current implementation.
2. Treat `.plans/` as proposed or historical design unless confirmed by code.
3. Identify the exact modules and files affected.
4. Call out API, database, queue, or sync-state-machine changes explicitly.
5. When a daemon API changes, include the corresponding CLI client (unless not implemented yet).
6. Prefer the smallest change that preserves the existing boundaries.
7. Do not restate the full architecture; reference the relevant source files or
   documentation sections instead.

When documentation and implementation disagree, mention the discrepancy and use
the implementation/tests as the current source of truth.

## Testing strategy

- This project prefers integration tests (named "e2e" in the daemon) and CLI-to-daemon end-to-end tests over unit tests. Only write unit tests to check application-level behaviors or utils. Applies for both CLI and daemon
- Don't add tests while writing codes

## Verification commands

Daemon:

```sh
cd daemon
pnpm run build
pnpm run lint
pnpm run test:e2e
```

Database changes:

```sh
cd daemon
pnpm run db:generate
pnpm run db:migrate
```

CLI:

```sh
cd cli
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build
```

## Reference documents

- `README.md`: setup and user-facing commands
- `ARCHITECTURE.md`: detailed modules, API, schema, and sync lifecycle
- `SECURITY.md`: threat model and hardening requirements
- `.plans/`: roadmap and design proposals, not necessarily implemented
