# Obsync Architecture Decisions

> Captured from a structured council review session on 2026-05-20.
> These decisions represent the shared understanding of the system design and should guide all implementation work.

---

## Sync Contract

The MVP contract is **stateless convergence**, not step resume:

```
obsync sync = converge the vault from its current state
not
obsync sync = resume a previous daemon-internal step exactly
```

- The `SyncJobRunner` always starts from `pull`, every time.
- The `allowedPreviousSteps` map in `runSyncOperation` stays as a **DB-level safety net only** — not as resume logic. It guards against implementation mistakes and is kept for future extensibility.
- Retries create a **new** sync operation; they never reuse a terminal one.

---

## Startup Reconciliation

On daemon startup, all dangling `queued` or `running` sync operations must be marked `aborted/done` with error code `DAEMON_INTERRUPTED`.

**Implementation**: A `StartupReconciliationService` using the `OnApplicationBootstrap` NestJS lifecycle hook.

- This is **cleanup**, not recovery.
- After startup, if the user wants a sync, they call `obsync sync` which creates a fresh operation.

---

## SyncVaultHandler — Stale Operation Abort

The current `SyncVaultHandler` calls `queueSyncOperation` directly without aborting stale active DB records. The correct flow is:

1. Add `hasVaultWork(vaultId): boolean` to `SyncQueue` using `queue.size + queue.pending > 0`.
2. In `SyncVaultHandler.execute()`:
   - Check in-memory queue first.
   - If **busy** → return the existing active operation (or a clear "already running" response).
   - If **idle** → abort any stale `queued`/`running` DB record for that vault.
   - Create a fresh `queued/pull` operation.
   - Enqueue the background job.

---

## Cooperative Abort

**Deferred post-MVP.**

The plan for cooperative abort (adding `abortRequestedAt` to the schema, `requestAbortSyncOperation` / `getAbortRequested` repository methods, and runner boundary checks) is well-defined but will not be implemented in MVP.

---

## Conflict Handling

**MVP scope**, sequenced after sync queue + startup reconciliation work.

### MVP Behavior

- MVP conflict strategy is always **`log-and-skip`**: record the conflict, mark the sync operation `failed/done` with error code `MERGE_CONFLICT`, let the user resolve manually.
- `stash-and-retry` is a **post-MVP** feature.
- `MergeConflictError` already extends `AppError` with `code = 'MERGE_CONFLICT'`, so failure recording already works correctly.
- The missing piece is creating a `conflict_record` row. This will be done in the runner by catching `MergeConflictError` explicitly before the generic catch, inserting the record, then re-throwing.

### Implementation

A `ConflictModule` will be scaffolded with a `ConflictRepository` (or conflict insert inlined into `SyncRepository`). The runner will catch `MergeConflictError`, create the record, then re-throw for standard failure recording.

---

## `get-sync-status` Response Shape

The query should return a **richer object**:

- The **active operation** (if one exists — `queued` or `running`), or `null`.
- The **last N completed operations** for the vault (for history at-a-glance).
- Fields: `id`, `status`, `step`, `error`, `commitSha`, `startedAt`, `updatedAt`.

The query file at `src/sync/queries/get-sync-status.query.ts` is currently a TODO placeholder.

---

## CLI ↔ Daemon Communication

- **Commands and queries**: HTTP REST.
- **Real-time sync progress streaming**: SSE (Server-Sent Events).
- The CLI is a **thin Rust frontend** — all sync logic lives in the daemon. The CLI has no Git logic of its own.

---

## Git Credentials

**System credential store only.** No in-app credential management.

The daemon inherits the user's environment, so SSH keys, macOS Keychain, git-credential-helper, etc. are all managed outside the app. `RemoteAuthError` is surfaced to the user as-is.

---

## `isDirty` Field

Kept in the schema. Reserved for **post-MVP auto-sync** when a file system watcher (`chokidar` or similar) is wired up. Currently never written to by any code path.

---

## Auto-Sync Scheduling

**Post-MVP.** When implemented:

- Use `@nestjs/schedule` with a **per-vault dynamic interval**.
- Reads `autoSync` and `syncInterval` from the vault config.
- Dispatches `SyncVaultCommand` automatically at the configured interval.
- `isDirty` will be used to skip unnecessary syncs.

---

## CQRS

**Stays.** The CommandBus/QueryBus pattern is load-bearing:

- Consistent across the codebase.
- Will be valuable when SSE event emission is added (emit `SyncStartedEvent` / `SyncCompletedEvent` via EventBus).
- Future saga-like flows (e.g., auto-sync coordination) benefit from the separation.

---

## SQLite Configuration

Enable **WAL mode** explicitly on connection init:

```sql
PRAGMA journal_mode=WAL;
```

This prevents reader/writer blocking when multiple vaults trigger concurrent DB reads/writes. To be added to `Database` class in `src/database/database.ts`.

---

## Testing Strategy

**Integration tests** are the preferred approach (not pure unit tests with everything mocked — see comment in `create-vault.handler.spec.ts`).

### Setup

- Real temp-file (or in-memory) SQLite DB.
- Real Drizzle ORM + real repositories.
- `GitService` mocked at the service boundary.
- Tests the full command → handler → repository → DB chain.

### Checklist (from `sync-operation-robustness.md`)

Key scenarios to cover:

- Daemon startup aborts all `queued` and `running` operations.
- Sync request aborts a stale active operation before creating a fresh one.
- Sync request does **not** abort a truly in-process (in-memory) sync job.
- Starting a sync creates an active sync operation.
- Different vaults can sync independently.
- Successful sync transitions to `success/done`.
- Failed sync transitions to `failed/done` with a specific error code.
- Step transition failure stops the runner before Git work.
- Vault update/delete rejected while active sync exists.
- Merge conflict records a `conflict_record` and marks the sync op terminal.

Do **not** add resume-specific tests for MVP.

---

## Daemon Process Lifecycle

- The daemon is a **persistent background service** managed by the OS init system (systemd on Linux, launchd on macOS).
- Installed as a system service when the user runs `obsync install`.
- The CLI detects whether the daemon is running before issuing commands.
- All sync logic is in the daemon — the CLI is purely a presentation layer.

---

## MVP Implementation Order

1. `hasVaultWork(vaultId)` on `SyncQueue` + `SyncVaultHandler` stale-abort logic
2. `StartupReconciliationService` with `OnApplicationBootstrap`
3. WAL mode in `Database`
4. `ConflictModule` scaffolding + runner integration (`MergeConflictError` → `conflict_record`)
5. `GetSyncStatusQuery` implementation (active operation + last N completed)
6. Integration test suite for the sync robustness checklist

### Post-MVP (deferred)

- Cooperative abort (`abortRequestedAt`, `requestAbortSyncOperation`, runner boundary checks)
- `stash-and-retry` conflict strategy
- Auto-sync scheduling (`@nestjs/schedule` per-vault dynamic interval)
- File system watcher for `isDirty`
- Smart resume (interrupted/conflicted statuses, `currentStep`/`lastCompletedStep`, Git-state inspection)
