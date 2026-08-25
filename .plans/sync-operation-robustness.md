# Sync Operation Robustness — Remaining Work

> Behavioral spec (state machine, startup reconciliation, abort semantics,
> conflict recording) now lives in `ARCHITECTURE.md` — this file keeps only
> open work. The MVP contract remains **stateless convergence**: never resume;
> abort dangling operations and start fresh from current vault/Git state.
> Deferred ideas are indexed in ROADMAP.md → Post-MVP.

---

## Testing Checklist

Focused tests still to add:

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

Do **not** add resume-specific tests for MVP:

- daemon startup enqueues old queued operations
- daemon startup resumes stale running operations
- commit succeeded but DB update failed then resumes from commit
- push retry after daemon restart

Those belong to a future smarter recovery design, not the stateless-sync contract.

---

## Post-MVP pointers

- **Cooperative abort** (`abortRequestedAt`) — see ROADMAP Post-MVP table
- **Future recovery option** (resume-aware design) — deliberately deferred;
  revisit only if stateless convergence proves insufficient
