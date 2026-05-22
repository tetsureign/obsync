# Sync Operation Robustness Plan

## Goal

Keep `obsync sync` durable enough to be observable and safe, but simple enough to behave like a mostly stateless command.

The daemon should not try to resume an old internal workflow snapshot after interruption. If a sync operation was left dangling, abort it and start a fresh sync from the vault's current filesystem and Git state.

This is the intended MVP contract:

```txt
obsync sync = converge the vault from its current state
not
obsync sync = resume a previous daemon-internal step exactly
```

The sync operation table is still valuable as audit history, active-operation guardrail, CLI status source, and vault-mutation protection.

## Current Code Snapshot

Already implemented:

- `sync_operations` has `status`, `step`, `error`, `commitSha`, `startedAt`, timestamps, and a partial unique index named `sync_operations_one_active_per_vault`.
- Active operations are currently `queued` and `running`.
- `SyncRepository` has `getActiveSyncOperation`, `getAllActiveSyncOperations`, `abortActiveSyncOperation`, `abortAllActiveSyncOperations`, `queueSyncOperation`, `runSyncOperation`, `completeSyncOperation`, and `failSyncOperation`.
- `SyncQueue` serializes work per vault with `PQueue({ concurrency: 1 })`.
- `SyncVaultHandler` reads the vault, creates a queued operation, enqueues a background job, and returns the operation.
- `SyncJobRunner` records each step before doing Git work and treats pre-Git step persistence as mandatory.
- Final success/failure persistence is best effort and logged if it fails.
- `VaultRepository` already rejects update/delete while active sync operations exist.
- `conflict_records` already exists as a table, but conflict handling is not yet a first-class module.

Not yet matching this plan:

- `SyncVaultHandler` currently calls `queueSyncOperation` directly. It does not abort a dangling active operation first.
- `SyncQueue` does not yet expose whether a vault queue has in-memory work running or waiting.
- Daemon startup does not yet call `abortAllActiveSyncOperations`.
- `get-sync-status` is still a TODO.
- Conflict handling is still mostly a placeholder.
- Cooperative user-requested abort is intentionally post-MVP.

## Data Model

The existing model is good enough for the stateless-sync plan:

```ts
syncOperations {
  id
  vaultId
  status       // queued | running | success | failed | aborted
  step         // pull | stage | commit | push | done
  error
  commitSha
  startedAt
  updatedAt
  createdAt
}
```

`status` represents operation lifecycle.

`step` represents the step the runner was about to attempt or most recently attempted. For terminal operations, use `step = done`.

`commitSha` stays nullable because a sync may not create a commit.

No new `resumable`, `interrupted`, or `conflicted` status is needed for MVP.

## Active Operation Rule

Keep the DB-level rule that allows only one active sync per vault:

```sql
CREATE UNIQUE INDEX sync_operations_one_active_per_vault
ON sync_operations(vault_id)
WHERE status IN ('queued', 'running');
```

This remains useful even with one daemon process because it protects against duplicate enqueueing and implementation mistakes.

For MVP, do not use active operations as resumable workflow state. Use them as:

- an in-progress marker
- a mutation guard for vault update/delete
- a status source for the CLI
- an audit trail if the daemon or command was interrupted

## Sync Flow

On `obsync sync` / sync API call:

1. Load the vault.
2. Check whether this daemon currently has in-memory sync work for that vault.
3. If the per-vault queue is busy, do not abort the current operation out from under the runner. Return the active operation or a clear already-running response. User-requested abort can be added after MVP.
4. If the per-vault queue is idle, abort any active `queued` or `running` operation for that vault. At that point the active DB record is considered stale/dangling.
5. Create a fresh `queued/pull` operation.
6. Enqueue a background job for that new operation in the per-vault queue.
7. Return the queued operation.
8. Runner starts from `pull` every time.
9. Before each Git phase, atomically mark the operation `running/<step>`.
10. On success, mark `success/done` and persist `commitSha` if available.
11. On ordinary failure, mark `failed/done` and persist a specific error code.
12. On conflict, record conflict details separately and mark the sync operation terminal for MVP.

This keeps the CLI behavior simple: every explicit sync request starts a new attempt from the current vault state unless this daemon is already actively syncing that vault.

## Startup Reconciliation

On daemon startup:

1. Query all active operations:

   ```sql
   SELECT *
   FROM sync_operations
   WHERE status IN ('queued', 'running');
   ```

2. Mark them `aborted/done`.
3. Do not enqueue or resume them.

Suggested error code:

```txt
DAEMON_INTERRUPTED
```

Startup reconciliation is cleanup, not recovery. If the user wants sync after startup, they call `obsync sync`, which creates a fresh operation.

## State Transitions

Keep terminal records terminal:

```txt
queued  -> running
queued  -> aborted
running -> success
running -> failed
running -> aborted
```

Terminal states:

```txt
success/done
failed/done
aborted/done
```

Do not allow terminal operations to become active again:

```txt
success -> running
failed  -> running
aborted -> running
```

Retries should create a new operation instead of reusing the old one.

## Step Recording

Keep the current "record step before Git" model.

`runSyncOperation(id, step)` is not just logging. It is an atomic transition guard:

- set `status = running`
- set the current step
- only update rows that are still active
- reject illegal transitions by returning no row

The runner should stop before Git if this transition cannot be recorded. This avoids doing filesystem/Git work when the durable operation state cannot be updated.

Possible naming cleanup later:

```txt
recordStepOrStop -> startStepOrStop
runSyncOperation -> startSyncOperationStep
```

The current names are workable, but the desired meaning is "attempt to start this step atomically."

## Conflict Handling

Conflicts are different from stale operation records. A stale operation can be aborted and forgotten for control-flow purposes. A merge conflict is real Git working-tree state.

For MVP:

1. Detect `MergeConflictError`.
2. Create a `conflict_record` with the vault id, conflicted files when available, and `strategy = log-and-skip`.
3. Mark the sync operation terminal, probably `failed/done` with `error = MERGE_CONFLICT`.
4. Let the user inspect/resolve the Git conflict.
5. A later `obsync sync` starts fresh from whatever state the vault is currently in.

`stash-and-retry` is post-MVP. The first conflict implementation should catch `MergeConflictError` explicitly, insert the conflict record, then re-throw so the existing failure path records `MERGE_CONFLICT` on the sync operation.

Avoid adding `conflicted` status until conflict resolution becomes a real workflow. If that status is added later, update the active-operation unique index to include it:

```sql
WHERE status IN ('queued', 'running', 'conflicted')
```

## Vault Mutation During Sync

Vault metadata should not change while an active sync exists for that vault.

The current repository-layer behavior already matches this direction: update/delete should reject when a `queued` or `running` operation exists.

This avoids holding long database transactions across Git operations while still preventing obvious vault config changes during active sync.

## Error Handling

Use specific error codes instead of collapsing everything to `UNKNOWN_ERROR` where the source error is known.

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
- `SYNC_OPERATION_PERSISTENCE_FAILED`

Persist the error code on the sync operation when possible.

Keep the original error cause in logs, but avoid exposing raw implementation errors directly through CLI/API responses.

## Abort Semantics

For MVP, "abort" only means stale-state cleanup.

Stale-state abort means "this previous active operation is no longer trusted as a workflow snapshot."

Use stale-state abort in two places:

- daemon startup: abort all active operations
- new sync request: abort a stale active operation for that vault before creating a fresh one

Because the daemon is expected to run as a single process, the per-vault queue is the source of truth for whether work is actually in flight in memory. The abort-before-queue behavior is for stale DB state and "start fresh" semantics, not for cancelling an active runner.

User-requested abort is post-MVP. For the MVP, if the queue says a vault has in-memory work running or waiting, return the active operation or a clear already-running response instead of trying to cancel it.

## Status Query

`get-sync-status` should return both current state and recent history for a vault.

Return:

- active operation, if one exists, or `null`
- last N completed operations
- operation fields: `id`, `status`, `step`, `error`, `commitSha`, `startedAt`, `updatedAt`

If no active operation exists, `activeOperation` should be `null`; the completed-operation list provides history at a glance.

## Testing Checklist

Add focused tests for:

- daemon startup aborts all `queued` operations
- daemon startup aborts all `running` operations
- sync request aborts an existing active operation for the vault
- sync request creates a fresh `queued/pull` operation after aborting stale active state
- sync request does not abort a truly running in-process sync job
- terminal operations are ignored when starting a new sync
- starting a sync creates an active sync operation
- different vaults can sync independently
- successful sync transitions to `success/done`
- failed sync transitions to `failed/done` and stores an error code
- step transition failure stops before Git
- vault update is rejected while active sync exists
- vault delete is rejected while active sync exists
- merge conflict records a conflict and marks the sync operation terminal

Do not add resume-specific tests for MVP:

- daemon startup enqueues old queued operations
- daemon startup resumes stale running operations
- commit succeeded but DB update failed then resumes from commit
- push retry after daemon restart

Those belong to a future smarter recovery design, not the current stateless-sync contract.

## Implementation Order

1. Add a small `SyncQueue` helper for per-vault queue state, such as `hasVaultWork(vaultId)`, using `queue.pending` and `queue.size`.
2. Update `SyncVaultHandler` so idle/stale active operations are aborted before `queueSyncOperation`, but busy in-process operations are not aborted.
3. Add a startup cleanup service/hook that calls `abortAllActiveSyncOperations`.
4. Keep the existing per-vault `SyncQueue` flow.
5. Keep `SyncJobRunner` starting from `pull`; do not add resume logic.
6. Optionally rename step-recording methods to better express atomic step start.
7. Implement `GetSyncStatusQuery`.
8. Add conflict module scaffolding around `conflict_records`.
9. Handle `MergeConflictError` in the runner by recording a conflict and marking the operation terminal.
10. Add tests for startup abort, sync-call stale abort, in-process busy behavior, terminal history, transitions, and conflicts.

## Post-MVP Cooperative Abort

Cooperative user-requested abort is useful, but it is not part of the MVP robustness work.

When it becomes worth implementing, support a second abort meaning:

- stale-state abort: terminal cleanup of old active records
- user-requested abort: cooperative cancellation of queued or running work

The likely data-model addition is:

```ts
syncOperations {
  abortRequestedAt
}
```

Queued abort is logical. Mark the queued operation with `abortRequestedAt`, or directly mark it `aborted/done` if the job has not started. The queued function should check operation state before doing Git work and no-op if it has already been aborted.

Running abort should be cooperative. The abort command should not set `status = aborted` while the runner is inside a Git operation. Instead:

1. CLI receives the user's key combination while streaming/watching logs.
2. CLI sends an abort request to the daemon for the active operation.
3. Repository sets `abortRequestedAt` if the operation is `queued` or `running`.
4. The runner checks for abort before each Git phase and between phases.
5. If abort was requested, the runner marks `aborted/done` and exits without recording failure.

Safe abort boundaries:

- before `pull`
- after `pull`, before `stage`
- after `stage`, before `commit`
- after `commit`, before `push`
- after `push`, before final success recording

Do not hard-cancel the currently executing Git command in the first version of this feature. If the user aborts while `pull` is running, `pull` may finish, then the runner stops before `stage`.

User abort is not a sync failure. It should not store `UNKNOWN_ERROR`, should not go through ordinary failure recording, and should not be logged as a runner error.

Suggested repository methods:

```txt
requestAbortSyncOperation(operationId)
getAbortRequested(operationId)
abortSyncOperation(operationId, error?)
```

`abortSyncOperation` should only finalize active operations. It should return no row if the operation is already terminal, and callers should treat that as a controlled no-op where appropriate.

Post-MVP tests should cover:

- abort request marks a queued operation aborted or abort-requested
- abort request sets `abortRequestedAt` for a running operation
- runner stops after the current Git phase when abort was requested
- user abort records `aborted/done`, not `failed/done`
- user abort does not store `UNKNOWN_ERROR`

If hard cancellation is added later, the Git execution layer needs cancellation support.

## Future Recovery Option

If the stateless model becomes painful, a future design can add smart resume. That would require:

- non-terminal `interrupted` or `conflicted` statuses
- clearer step semantics, possibly `currentStep` plus `lastCompletedStep`
- Git-state inspection before deciding where to continue
- careful handling for commit-created-but-not-recorded cases
- remote containment checks before retrying push

Do not build this until real usage shows the simple model is not enough.
