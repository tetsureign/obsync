# Sync State Machine Review Notes

Findings from auditing the TS daemon (`daemon/src/sync/`) ahead of porting to `daemon-rs` (see [daemon-rust-migration.md](daemon-rust-migration.md)).

## Keep as-is

- **Single `sync_operations` row (`status` + `step`)**: Retain `step` for failure diagnostics (e.g., failing at `push` with a local commit differs from failing at `pull`).
- **Compare-and-set step transitions (`WHERE status IN ('queued', 'running')`)**: Currently serves as a zombie/stale-op safety gate (since TS `POST /:name/abort` only aborts `queued` ops per `abort-sync.command.ts`), and remains the right boundary pattern once real in-flight cancellation lands in Rust.
- **Partial unique index + boot cleanup**: `sync_operations_one_active_per_vault` enforces the concurrency rule in SQLite, paired with startup cleanup (`abortAllActiveSyncOperations()`) so crashes don't permanently lock a vault. Note: TS only sets `status = 'aborted'` (`DAEMON_INTERRUPTED` is only in `.plans/`), so make sure Rust actually writes that error code on boot.

## Simplify in the Rust port

- **Decide: reject-while-busy vs. real queueing**: Currently `SyncVaultHandler` inserts a `queued` row before enqueuing into `SyncQueue` (`PQueue({ concurrency: 1 })`), so the partial unique index rejects any second request before it can queue (`priority` is unused; `SyncQueue` only acts as a background spawner + busy check). Either:
  - Embrace reject-while-busy (or coalesce for auto-sync) and use a per-vault mutex/task handle, or
  - Narrow the partial unique index to `WHERE status = 'running'` if actual queueing is desired.
- **Drop `pRetry` on SQLite final-state writes**: Local SQLite doesn't benefit from 0.5s/1s/2s exponential backoff; rely on SQLite `busy_timeout` (already in `daemon-rust-migration.md`, though the `runner.rs` note still mentions `+ retry`).
- **Collapse persistence error classes**: Replace the 4 separate errors (`SyncOperationPersistenceError`, `SyncQueueRecordPersistenceError`, `SyncSuccessPersistenceError`, `SyncFailurePersistenceError`) with a single `SyncError` persistence variant (or DB error).
- **Optional (`step: 'done'`)**: Redundant with `status: 'success'`; decide whether to keep for wire compatibility or drop during the lockstep CLI update.

## Bugs & gaps to fix

- **Abort triggers failure persistence + retries (when running ops are aborted)**: TS `POST /:name/abort` only aborts `queued` ops today, so this path only triggers if a `running` op is aborted externally (e.g., zombie/stale cleanup) — and will become a live UX bug once real in-flight abort lands in Rust. In `sync-job.runner.ts`, `startSyncOperationStep` returns nothing → throws `SyncStepTransitionError` → `recordFailureBestEffort` runs `failSyncOperation` (`WHERE status IN ('queued', 'running')`) → matches 0 rows → throws `SyncFailurePersistenceError` → `persistFinalStateWithRetry` retries 3x (~3.5s) and logs two spurious errors.
  - *Fix*: Treat `aborted` (via cancellation token or checking status) as an expected terminal outcome and exit cleanly without marking failed or retrying.
- **Standalone `git-{pull,stage,commit,push}` routes bypass serialization**: They do a TOCTOU check via `getActiveSyncOperation`, create no op row, and skip `SyncQueue`, allowing concurrent Git mutations against the same vault.
  - *Fix*: Route them through the same per-vault lock/serializer, or drop the standalone mutating endpoints if unnecessary.
- **Conflict logging records requested stage paths, not conflicting files**: In `sync-job.runner.ts`, `conflictRepository.create` stores `JSON.stringify(syncJob.filePaths)` (which defaults to `["."]`) rather than the actual conflicting paths reported by Git.
  - *Fix*: Parse/extract the conflicting file list from Git (`git diff --name-only --diff-filter=U` or porcelain status) when logging conflicts.
- **Startup migrations swallow errors**: `daemon/src/main.ts` wraps `migrate()` in a `try/catch` that logs the error without rethrowing, logs `"Database migrations completed."`, and proceeds to boot anyway.
  - *Fix*: Fail fast and abort startup if `sqlx::migrate!` returns an error.
