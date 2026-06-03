# Vault Git Setup

> Captured from a design session on 2026-06-03.
> Covers Git-backed vault creation, remote-backed vs local-only vaults, and Obsidian `.gitignore` handling.

---

## Goal

`obsync add` should make the vault usable immediately, not just save hopeful metadata.

When a user adds or updates a vault, the daemon should verify the Git state before writing the vault record. Bad paths, bad remotes, auth failures, missing branches, and non-repo folders should fail at add/update time with clear domain errors.

This replaces complex remote URL validation with Git-backed verification wherever possible.

---

## Vault Modes

### Remote-backed vault

`remote` is required.

The daemon should:

- Clone the remote if `localPath` does not exist or is an empty directory.
- Validate the existing repo if `localPath` is already a Git repo.
- Verify `origin` matches the requested remote.
- Verify the requested branch exists locally or on `origin`.
- Store the vault only after Git verification succeeds.

This mode supports full sync: `pull`, `stage`, `commit`, and `push`.

### Local-only vault

`remote` is `null`.

The daemon should:

- Run `git init` if `localPath` is not already a repo.
- Validate the existing repo if `localPath` is already a Git repo.
- Add an Obsidian-oriented `.gitignore` if one does not already exist.
- Store the vault as Git-backed but not remote-syncable.

This mode supports local Git operations such as `status`, `diff`, `stage`, and `commit`.

It does not support `pull`, `push`, or full remote sync until a remote is attached.

---

## Schema And DTO Changes

Make `vaults.remote` nullable.

Update the affected surfaces:

- Drizzle schema: `remote` becomes nullable.
- Vault payload and response types.
- Create/update DTO schemas.
- Any Git service methods or sync commands that currently assume `remote: string`.

Keep DTO validation small:

- `localPath`: absolute path, normalized.
- `remote`: nullable non-empty string.
- `branch`: non-empty string.

Do not add complex URL regex validation in the MVP. Let Git validate remote reality.

---

## Git Service Shape

Add a higher-level method:

```ts
ensureVaultReady({
  localPath,
  remote,
  branch,
}: {
  localPath: string;
  remote: string | null;
  branch: string;
})
```

Expected behavior:

- `remote !== null`: ensure a remote-backed vault.
- `remote === null`: ensure a local-only vault.

Keep lower-level helpers private where useful:

- `cloneVault`
- `initVault`
- `assertOriginMatches`
- `assertBranchExists`
- `writeDefaultGitignoreIfMissing`

Prefer Git operations over hand-parsed remote URL rules.

---

## Sync Behavior

Remote-backed vaults:

- `status`: allowed
- `diff`: allowed
- `stage`: allowed
- `commit`: allowed
- `pull`: allowed
- `push`: allowed
- `sync`: allowed

Local-only vaults:

- `status`: allowed
- `diff`: allowed
- `stage`: allowed
- `commit`: allowed
- `pull`: rejected
- `push`: rejected
- `sync`: rejected

Add a domain error such as `REMOTE_REQUIRED` for operations that require a remote.

The user-facing message should explain that the vault is local-only and needs a remote before it can sync.

---

## Obsidian `.gitignore`

Use the official Obsidian guidance as the baseline:

- Obsidian stores vault settings in `.obsidian`.
- Obsidian notes that workspace layout files such as `.obsidian/workspace.json` and `.obsidian/workspaces.json` may be useful to add to `.gitignore` when using Git.

Default behavior:

- If `.gitignore` does not exist, create one with the Obsidian baseline entries.
- If `.gitignore` already exists, do not overwrite it.
- The CLI should tell the user that the generated `.gitignore` is only a starting point and they may want to customize it for plugins, themes, attachments, or device-specific settings.

Do not auto-ignore broad folders such as `.obsidian/plugins/` or `.obsidian/themes/` in the MVP. Some users intentionally sync those.

References:

- https://obsidian.md/help/data-storage
- https://obsidian.md/help/sync-notes

---

## Command Flow

### Create

1. Validate DTO.
2. Run `GitService.ensureVaultReady(...)`.
3. Insert vault row.
4. Return saved vault.

If Git setup succeeds but DB insert fails because of duplicate name/path, leave the Git repo as-is. Do not try to undo user filesystem state.

### Update

1. Validate DTO.
2. Load existing vault.
3. Merge existing values with provided update fields.
4. Run `GitService.ensureVaultReady(...)` with the effective values.
5. Update vault row if no active sync operation exists.
6. Return saved vault.

If the vault is currently syncing, reject before mutating Git state.

---

## Testing Strategy

Prefer focused tests over making every HTTP e2e test depend on real Git.

Command handler tests:

- `CreateVaultHandler` calls `ensureVaultReady` before insert.
- `UpdateVaultHandler` loads existing data, merges partial payload, and verifies the effective Git config.
- Git failures prevent DB writes.
- Local-only vaults save `remote: null`.

Git service tests:

- Existing repo with matching origin passes.
- Existing repo with mismatched origin fails.
- Missing/empty path with remote clones.
- Local-only missing/empty path runs `git init`.
- Existing `.gitignore` is preserved.
- Missing `.gitignore` gets the Obsidian baseline.

Sync command tests:

- Local-only vault rejects `pull`, `push`, and full `sync` with `REMOTE_REQUIRED`.
- Local-only vault still allows `status`, `diff`, `stage`, and `commit`.

Use local temp repositories and local bare remotes for Git service tests. Avoid network remotes.

---

## Implementation Order

1. Make `remote` nullable in schema, DTOs, and types.
2. Import `GitModule` into `VaultModule`.
3. Implement `GitService.ensureVaultReady`.
4. Call it from create and update handlers.
5. Add `REMOTE_REQUIRED` and guard remote-only sync commands.
6. Add focused command and Git service tests.
7. Add CLI copy for local-only mode and `.gitignore` customization.
