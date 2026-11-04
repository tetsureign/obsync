# Obsync Architecture Decisions

> Captured from a structured council review session on 2026-05-20.
> These decisions represent the shared understanding of the system design and should guide all implementation work.
>
> ✅ = implemented in codebase · ❌ = not yet implemented · 🔜 = deferred post-MVP

---

## ✅ Sync Contract

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

## ✅ Startup Reconciliation

On daemon startup, all dangling `queued` or `running` sync operations must be marked `aborted/done` with error code `DAEMON_INTERRUPTED`.

**Implementation**: `AppService` implements `OnApplicationBootstrap` and calls `abortAllActiveSyncOperations()` on boot.

- This is **cleanup**, not recovery.
- After startup, if the user wants a sync, they call `obsync sync` which creates a fresh operation.

---

## ✅ SyncVaultHandler — Stale Operation Abort

1. `hasVaultWorks(vaultId)` implemented on `SyncQueue` using `queue.size + queue.pending > 0`.
2. `SyncVaultHandler.execute()` calls `abortStaleSyncOperation()` which:
   - Checks in-memory queue first via `hasVaultWorks`.
   - If **busy** → skips abort (returns `null`), proceeds to queue a new operation.
   - If **idle** → aborts any stale `queued`/`running` DB record for that vault.
   - Creates a fresh `queued/pull` operation and enqueues the background job.

---

## 🔜 Cooperative Abort

**Deferred post-MVP.**

The plan for cooperative abort (adding `abortRequestedAt` to the schema, `requestAbortSyncOperation` / `getAbortRequested` repository methods, and runner boundary checks) is well-defined but will not be implemented in MVP.

---

## ❌ Conflict Handling (Phase 1 — in progress)

### MVP Behavior

- MVP conflict strategy is always **`log-and-skip`**: record the conflict, mark the sync operation `failed/done` with error code `MERGE_CONFLICT`, let the user resolve manually.
- `stash-and-retry` is a **post-MVP** feature.
- `MergeConflictError` already extends `AppError` with `code = 'MERGE_CONFLICT'`, so failure recording already works correctly.
- The missing piece is creating a `conflict_record` row. This will be done in the runner by catching `MergeConflictError` explicitly before the generic catch, inserting the record, then re-throwing.

### Implementation

`conflict_records` table exists in schema. `ConflictRepository` or inline insert into `SyncRepository` needs to be wired into `SyncJobRunner`. See `ROADMAP.md` Phase 1.1.

---

## ✅ `get-sync-status` Response Shape

Returns:

- The **active operation** (if one exists — `queued` or `running`), or `null`.
- The **last N completed operations** for the vault (configurable via `recentSyncLimit`, default 5).
- Runtime queue state from `SyncQueue.getVaultQueueStatus()`.

Implemented in `src/sync/queries/get-sync-status.query.ts`.

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

## ❌ Testing Strategy (Phase 1 — in progress)

**Integration tests** are the preferred approach.

### Setup

- Real temp-file SQLite DB (`test/helpers/test-db.ts` already provides this).
- Real Drizzle ORM + real repositories (`test/helpers/test-app.ts` boots full `AppModule`).
- `GitService` mocked at the `Test.createTestingModule()` boundary (decision locked in).
- Tests the full command → handler → repository → DB chain.

### Checklist (from `sync-operation-robustness.md`)

Key scenarios to cover (see `ROADMAP.md` Phase 1.3):

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

## 🔜 Daemon Process Lifecycle

- The daemon is a **persistent background service** managed by the OS init system (systemd on Linux, launchd on macOS).
- Installed as a system service via the onboarding wizard (`cli-daemon-onboarding.md`, Phase 5).
- The CLI detects whether the daemon is running via lockfile before issuing commands (`daemon-hardening.md`, Phase 2).
- All sync logic is in the daemon — the CLI is purely a presentation layer.

---

## Implementation Status

| Item                                                             | Status       |
| ---------------------------------------------------------------- | ------------ |
Still open: the integration/e2e test suite (see ROADMAP → E2E test suite re-sync).

### Post-MVP (deferred)

- Cooperative abort (`abortRequestedAt`, `requestAbortSyncOperation`, runner boundary checks)
- `stash-and-retry` conflict strategy
- Auto-sync scheduling (`@nestjs/schedule` per-vault dynamic interval)
- File system watcher for `isDirty`
- Smart resume (interrupted/conflicted statuses, `currentStep`/`lastCompletedStep`, Git-state inspection)
