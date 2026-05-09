# Sync Operation Robustness Plan

## Goal

Make vault sync durable, serializable per vault, observable by the CLI, and recoverable after daemon interruption.

The sync operation should be modeled as a durable state machine, not as a transient call that only writes a final history row.

## Naming

Use names like:

- `SyncOperation`
- `SyncJob`
- `SyncRun`
- `VaultSync`

## Data Model

Extend or replace the current `sync_records` history-only model with a stateful sync operation model.

Suggested fields:

```ts
syncOperations {
  id
  vaultId
  status       // queued | running | success | failed | aborted
  step         // pull | stage | commit | push | done
  error
  commitSha
  startedAt
  finishedAt
  updatedAt
  createdAt
}
```

`status` represents the operation lifecycle.

`step` represents the last known execution point.

`commitSha` should be nullable because a sync may not create a commit.

## Per-Vault Locking

Use the sync operation table as the lock source.

Add a DB-level rule that allows only one active sync per vault:

```sql
CREATE UNIQUE INDEX sync_operations_one_active_per_vault
ON sync_operations(vault_id)
WHERE status IN ('queued', 'running');
```

This is still useful even with an in-process queue because it protects against duplicate enqueueing, daemon restarts, and implementation mistakes.

For the expected architecture, assume one daemon process. The CLI should talk to the daemon instead of directly running sync logic. Use `p-queue` inside the daemon for lightweight scheduling.

Suggested queue design:

- one queue per vault with concurrency `1`, or
- a global queue plus DB-backed active-sync checks

Different vaults may sync concurrently. Operations for the same vault must serialize.

## Sync Flow

1. User requests sync through CLI/API.
2. Daemon attempts to create a `queued` sync operation for `vaultId`.
3. If an active sync already exists, return or subscribe to that operation instead of starting another one.
4. Queue worker marks the operation `running`.
5. Worker reads the vault once at sync start.
6. Worker runs git steps using stable vault data.
7. Before or after each step, persist progress in `step`.
8. On success, mark operation `success`, set `step = done`, persist `commitSha`, and update vault metadata such as `lastSyncedAt` if needed.
9. On failure, mark operation `failed` and persist a specific error code.

Keep existing validation inside standalone git commands, but avoid letting the orchestrated sync re-read mutable vault data before every step. The sync operation should use one vault snapshot for the whole run.

## State Transitions

Valid transitions:

```txt
queued -> running
running -> success
running -> failed
running -> aborted
failed -> queued    // retry, if supported
failed -> running   // retry, if reusing the same operation
```

Invalid transitions should be rejected in code.

Do not allow:

```txt
success -> running
aborted -> running
success -> failed
```

## Git Step Recovery

Do not trust the DB step alone after interruption. On resume, inspect git state too.

Step-specific notes:

- `pull`: usually safe to retry, but handle conflicts explicitly.
- `stage`: usually safe to retry with the same file paths.
- `commit`: tricky. The daemon may have died after the commit succeeded but before `commitSha` was saved.
- `push`: usually safe to retry if the local branch is ahead of remote.

Recovery should inspect:

- working tree status
- staged files
- latest commit
- whether the local branch is ahead of the remote
- whether the remote already contains the commit
- conflict state

The database tells the daemon where it thought it was. Git tells the daemon what actually happened.

## Startup Reconciliation

On daemon startup:

1. Query active operations:

   ```sql
   SELECT *
   FROM sync_operations
   WHERE status IN ('queued', 'running');
   ```

2. Enqueue `queued` operations.
3. For `running` operations, inspect the repository state.
4. Either resume safely or mark the operation `failed` with a daemon interruption error.

Suggested error code:

```txt
DAEMON_INTERRUPTED
```

If exact resume semantics are hard, prefer marking interrupted operations as failed and allowing a fresh sync, as long as git state is inspected first to avoid duplicate commits or incorrect pushes.

## Vault Mutation During Sync

Vault metadata should not change while an active sync exists for that vault.

Update and delete commands should check the sync operation table before mutating a vault:

```txt
if active sync exists for vault:
  reject update/delete
```

This avoids holding long database transactions across git operations.

If later the daemon exposes standalone `pull`, `push`, `commit`, or `stage` commands, decide whether they also create short-lived sync operations or use the same per-vault operation queue.

## Error Handling

Use specific error codes instead of collapsing everything to `UNKNOWN_ERROR`.

Useful categories:

- `VAULT_NOT_FOUND`
- `INVALID_VAULT`
- `REMOTE_UNAVAILABLE`
- `GIT_AUTH_FAILED`
- `MERGE_CONFLICT`
- `NOTHING_TO_COMMIT`
- `PUSH_REJECTED`
- `WORKING_TREE_DIRTY`
- `SYNC_ALREADY_RUNNING`
- `SYNC_ABORTED`
- `DAEMON_INTERRUPTED`
- `SYNC_RECORD_PERSISTENCE_FAILED`

Persist the error code on the sync operation.

Where useful, keep the original error cause available to logs, but avoid exposing raw implementation errors directly through CLI/API responses.

## Abort Semantics

Define abort behavior explicitly.

Possible levels:

- queued operation: remove from queue or mark `aborted`
- running operation: mark `abort_requested` if that state is added later
- executing git process: send a cancellation signal

The simplest first implementation:

- queued operations can be aborted
- running operations cannot be cancelled immediately
- running operations may complete as success or failed

If hard cancellation is added later, the git execution layer needs cancellation support.

## Status Query

`get-sync-status` should query the active sync operation for a vault.

Return:

- operation id
- status
- step
- error
- commit sha
- timestamps

If no active operation exists, return the most recent completed operation or an explicit idle status.

## Testing Checklist

Add focused tests for:

- starting a sync creates an active sync operation
- duplicate sync requests for the same vault do not create two active operations
- different vaults can sync independently
- successful sync transitions to `success`
- failed sync transitions to `failed` and stores an error code
- vault update is rejected while active sync exists
- vault delete is rejected while active sync exists
- queued sync can be aborted
- running sync behavior is explicit and tested
- daemon startup enqueues `queued` operations
- daemon startup reconciles stale `running` operations
- commit succeeded but DB update failed
- push retry after daemon restart

## Implementation Order

1. Rename or extend sync persistence model to represent operations.
2. Add active-sync unique index.
3. Add repository methods:
   - create queued operation
   - claim/start operation
   - update step
   - complete success
   - complete failure
   - find active operation by vault
   - find resumable operations
4. Add queue service using `p-queue`.
5. Update `SyncVaultCommand` to create/claim/update/finalize a sync operation.
6. Update vault update/delete commands to reject mutation while active sync exists.
7. Implement `GetSyncStatusQuery`.
8. Implement basic abort for queued operations.
9. Add startup reconciliation.
10. Add recovery logic that inspects git state before resuming.
11. Add tests for concurrency, transitions, and recovery.
