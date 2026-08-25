# obsync — Roadmap (Remaining Work)

> Shipped history lives in git log + ARCHITECTURE.md. This file lists only
> what is still open; deferred ideas are indexed in Post-MVP below.

---

## Near term

### E2E test suite re-sync

`vault.e2e-spec.ts` predates TokenGuard and the id→name route migration. Two categories of fixes:

**Auth**:

- Every request needs `Authorization: Bearer <token>`; expose the token on
  `AppService` for tests (or read the lockfile) and send it via a shared
  supertest helper
- Sandbox XDG dirs in `test/helpers/test-app.ts` so tests stop clobbering the
  real `~/.local/share/obsync/daemon.json` lockfile

**Schema drift**:

- Remove `remote`/`branch` from payloads and assertions
- `CreateVaultHandler` calls `GitService.validateVaultGitRepo()` +
  `getEffectiveRemote()` before insert — mock `GitService` at the
  `Test.createTestingModule()` boundary (`{ provide: GitService, useValue: mockGitService }`),
  returning success by default, overriding per-test for error paths
- The `test/vault/` subdirectory is empty — move vault domain tests there,
  add coverage for the new Git-validation paths per `vault-git-setup.md`
- PATCH payloads use removed fields (`branch`) → update to current DTO fields
- Routes are name-based (`/vaults/:name`), not id-based → rework URL building
  and the UUID-not-found cases

**Sync robustness tests**: see Testing Checklist in `sync-operation-robustness.md`

### CLI daemon probe refinement

- Authenticated `GET /health` probe so a hung-but-alive daemon is reported
  accurately; include the resolved lockfile path in the error text
- Service-management hints in the error output (`systemctl --user start obsyncd`,
  `launchctl kickstart ...`)

### `--batch` / `--no-interactive` flag

- Clean non-TTY output for CI/CD, git hooks, scripting use

### Quickstart demo

- Minimal `docker-compose.yml` evaluating obsyncd locally (see
  `remote-daemon-selfhosting.md`); volume-mount a sample vault + data dir;
  health check probe

---

## Post-MVP (Deferred)

| Feature                                  | Source plan                 | Notes                                         |
| ---------------------------------------- | --------------------------- | --------------------------------------------- |
| `WatcherModule` (chokidar dirty flag)    | `initial-plan.md`           | `isDirty` field reserved in schema            |
| `SchedulerModule` (per-vault cron)       | `initial-plan.md`           | `autoSync` + `syncInterval` in schema         |
| SSE gateway + `obsync watch`             | `initial-plan.md`           | `EventBus`, `@Sse('/events')`, ratatui TUI    |
| `ConfigModule` (TOML export/import)      | `initial-plan.md`           | Vault registry export, interactive path remap |
| Auto-sync mode (WatcherModule → enqueue) | `initial-plan.md`           | Needs WatcherModule + SchedulerModule first   |
| Cooperative abort (`abortRequestedAt`)   | `architecture-decisions.md` | Post-MVP per plan                             |
| `stash-and-retry` conflict strategy      | `architecture-decisions.md` | `stash`/`stashPop` already in GitService      |
| `config.toml` daemon settings loading    | `daemon-hardening.md`       | preferred_port, log_level                     |
| Input validation hardening               | `daemon-hardening.md`       | Path traversal, remote URL scheme check       |
| Packaging (nFPM deb/rpm, bundled Node)   | `initial-plan.md`           | After service model is stable                 |
| Explicit multi-remote management         | `vault-git-setup.md`        | Drift detection deferred with it              |
| `obsync config export/import` CLI        | `initial-plan.md`           | Needs ConfigModule first                      |
| `obsync init`                            | `vault-git-setup.md`        | Clone/init Git setup command                  |
| Soft delete for vaults                   | `initial-plan.md`           | Hard deletes only for MVP                     |
