# Vault Git Setup

> Captured from a design session on 2026-06-03.
> Updated on 2026-07-23 after implementation review, CLI flow revision, and schema simplification.
> MVP direction: `obsync add` registers an existing Git-backed vault; `obsync init` owns setup.

---

## Decision

`obsync add` is a registration command, not a setup command.

The CLI accepts path-first registration:

```text
obsync vault add <path> [--name <name>]
```

`vaults` schema will **not** persist `remote` or `branch`. Git repository configuration (`.git/config` and `HEAD`) remains the sole source of truth for both:

- **Branch**: Sync operates dynamically on whatever branch the repository currently has checked out.
- **Remote**: Sync operates on the repository's configured remote (defaulting to `origin`), resolved dynamically via Git helpers.

Future explicit multi-remote management will be handled by a dedicated `remotes` table when implemented.

Any operation that creates or mutates Git state belongs in an explicit setup command such as `obsync init`. This keeps registration separate from clone/init/remote setup behavior.

MVP remains remote-backed sync only. Local-only vaults are deferred.

---

## Current Implementation Snapshot

Already implemented:

- **Schema Refactoring**: Removed `remote` and `branch` columns from `vaults` Drizzle schema (`daemon/src/database/schema.ts`).
- **Git Helpers**: Added `validateVaultGitRepo`, `inspectExistingVault`, `getEffectiveRemote`, and `getEffectiveBranch` helpers to `GitService`.
- **Daemon Handlers & DTOs**:
  - `CreateVaultCommand` / `CreateVaultHandler` validates Git repo & effective remote before DB insert, and automatically infers vault `name` from path directory name if omitted.
  - `UpdateVaultCommand` / `UpdateVaultHandler` updated to handle vault updates without `remote`/`branch`.
  - `vaultCoreSchema`, `createVaultCommandSchema`, and response schemas updated.
  - Sync commands (`commit`, `pull`, `push`, `stage`, etc.) updated to interact with `GitService` without DB-persisted `remote`/`branch`.
- `VaultModule` imports `GitModule`.

Still incomplete:

- CLI `vault add` implementation updates (`obsync vault add <path> [--name <name>]`) in Rust.
- Dedicated integration tests for `CreateVaultHandler` / `UpdateVaultHandler` and updating e2e test fixtures for the new schema.
- `obsync init` command.

---

## Target Behavior

### `obsync add`

CLI behavior:

- Minimal command: `obsync vault add <path> [--name <name>]`
- Infers default name from path directory name if omitted.
- Validates that `<path>` exists and is a valid Git repository with a configured remote before registration.

Daemon flow:

1. Validate `name` and `localPath`.
2. Inspect `localPath` to ensure it is a valid Git repository.
3. Call `GitService.getEffectiveRemote(localPath)` to verify a remote is configured (e.g. `origin`).
4. Call `GitService.getEffectiveBranch(localPath)` to verify a branch is checked out.
5. Insert the vault row with `name` and normalized `localPath`.

`add` must not:

- Run `git init`.
- Clone a remote.
- Add or change remotes.
- Check out or create branches.
- Write `.gitignore`.

If the path is not ready or not a Git repo, return a domain error prompting the user to run `obsync init` first.

### `obsync update`

Update handles identity and schedule changes (e.g., `name`, `localPath`, schedule interval).

Daemon flow:

1. Load the existing vault.
2. Merge update fields.
3. If `localPath` changed, validate that the new path is a valid Git repository with configured remote.
4. Persist update.

### `obsync init`

`init` owns setup and filesystem mutation.

MVP shape:

- Accept a path and remote URL.
- Clone the remote into the path when the path does not exist or is empty.
- For an existing directory, initialize Git, configure `origin`, and set up initial branch.
- Print follow-up command: `obsync vault add <path> [--name <name>]`.

---

## Daemon Changes

Schema:

- Remove `remote` and `branch` columns from `vaults` table schema.
- `vaults` table retains `id`, `name`, `localPath`, `createdAt`, `updatedAt` (and sync schedule settings).

DTOs and payload types:

- `CreateVaultDto` accepts `name` (optional, fallback to dirname) and `localPath`.
- `UpdateVaultDto` accepts `name`, `localPath`, etc. (no `remote` or `branch`).

Git service helpers:

```ts
inspectExistingVault(localPath: string): Promise<{
  localPath: string;
  detectedRemote: string | null;
  currentBranch: string | null;
}>

getEffectiveRemote(localPath: string, remoteAlias?: string): Promise<string>

getEffectiveBranch(localPath: string): Promise<string>

validateVaultGitRepo(localPath: string): Promise<void>
```

Expected behavior:

- `validateVaultGitRepo`: fails if `localPath` is not a Git repo.
- `getEffectiveRemote`: inspects git config for alias (default `origin`) and returns configured URL, throwing if missing.
- `getEffectiveBranch`: inspects `HEAD` to return current active branch.
- Sync operations query Git directly via `GitService` at runtime rather than reading cached DB fields.

---

## Testing Strategy

Integration tests using real temp directories and local bare remotes.

Priority tests:

- `add` with valid Git repo succeeds and stores `name` + `localPath`.
- `add` rejects non-repo path and does not insert a DB row.
- `add` rejects repo with no configured remote (`origin`).
- `add` rejects repo with detached HEAD state.
- Duplicate name/path fails without touching Git state.
- `update` path-changing validates target directory is a valid Git repo.
- Sync command reads current branch and remote at execution time.
- CLI `vault add <path>` infers name when missing.

---

## Implementation Order

1. [x] Update `vaults` schema in Drizzle to remove `remote` and `branch` columns, and update migrations.
2. [x] Implement focused `GitService` helpers (`getEffectiveRemote`, `getEffectiveBranch`, `validateVaultGitRepo`, `inspectExistingVault`).
3. [x] Update `CreateVaultHandler` and DTOs to only accept/persist `name` (with dirname fallback) and `localPath`, validating Git repo state.
4. [x] Update `UpdateVaultHandler` and DTOs.
5. [x] Update sync command implementations to query `GitService` dynamically for remote/branch.
6. [ ] Update CLI `vault add` command to path-first syntax (`obsync vault add <path> [--name <name>]`).
7. [ ] Add daemon integration tests for `add`/`update` validation and dynamic Git reading.
8. [ ] Add/plan `obsync init` as explicit Git setup command.
9. [ ] Refresh e2e test fixtures to reflect simplified schema and API.

---

## Deferred Scope

- **Explicit Multi-Remote Management**: Dedicate a `remotes` table (`vaultId`, `alias`, `url`, `isDefault`) when multi-remote support is implemented.
- **Local-Only Vaults**:
  - Allow local-only vaults without remotes.
  - Guard remote sync operations with `REMOTE_REQUIRED` domain error.
- **Drift Detection** (remote URL or branch changed externally between sync runs):
  - Since neither `remote` nor `branch` are persisted, detecting drift requires snapshotting the effective remote and branch in memory at registration or first sync, then comparing on each subsequent Git operation.
  - Desired behavior: throw a loud, clear domain error (e.g. `RemoteDriftError`, `BranchDriftError`) when a mismatch is detected.
  - Deferred because: implementing this before multi-remote management lands would tie the comparison logic to a single-remote assumption that will need to be unwound. The shape of "what to compare against" changes once the `remotes` table exists.
  - Worth acknowledging now so the eventual implementation is deliberate, not an afterthought.
