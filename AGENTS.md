# AGENTS.md

obsync is a self-hosted Obsidian vault sync tool. Main flow:
`CLI → localhost HTTP API → daemon → local vault/Git remote`

The CLI is a presentation/client layer only. No Git or sync logic there.

## Invariants

- All Git ops go through `GitService`.
- Sync order: `pull → stage → commit → push`
- Sync jobs are serialized per vault via `SyncQueue`.
- Active ops are `queued`/`running` DB rows.
- `remote` and `branch` are resolved at runtime, not persisted.
- Routes use vault names (`/vaults/:name/sync`). Ignore older ID-based docs.
- Validation: Zod + `nestjs-zod`. Errors: typed `AppError` subclasses.
- Schema changes require a Drizzle migration.

## Key modules

**Daemon** (`daemon/src/`):

| Concern             | Path          |
| ------------------- | ------------- |
| Git operations      | `git/`        |
| Sync orchestration  | `sync/`       |
| Queue               | `sync-queue/` |
| Vault CRUD          | `vault/`      |
| Conflict resolution | `conflict/`   |
| DB schema           | `database/`   |

**CLI** (`cli/src/`):

| Concern              | Path          |
| -------------------- | ------------- |
| HTTP client + models | `client/`     |
| Command handlers     | `commands/`   |
| Output rendering     | `output.rs`   |
| Daemon lockfile      | `lockfile.rs` |

## Don't read unless asked

- `ARCHITECTURE.md` — skim only if you need schema or API details
- `.plans/` — proposals, not source of truth

## Planning

- Start from code, not `.plans/` (those are proposals).
- Call out API, DB, queue, or state-machine changes explicitly.
- When daemon API changes, update the CLI client too.
- Prefer the smallest change that preserves boundaries.
- If docs and code disagree, follow the code/tests.

## Testing

- Prefer e2e/integration tests over unit tests (both CLI and daemon).
- Don't add tests while writing code.

## Verification (only for big changes)

```sh
# Daemon
cd daemon && pnpm run build && pnpm run lint && pnpm run test:e2e

# DB changes
cd daemon && pnpm run db:generate && pnpm run db:migrate

# CLI
cd cli && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo build
```
