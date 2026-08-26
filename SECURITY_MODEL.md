# Security model

This document explains the security choices in the current implementation. It
is design documentation, not a vulnerability-reporting channel; reports belong
in [SECURITY.md](SECURITY.md).

## Scope and trust boundaries

obsync is a local tool. The daemon runs on the user’s machine, binds to the
loopback interface, and is the only process that touches vault files or invokes
Git. The CLI is a client and presentation layer.

```text
CLI ── authenticated HTTP on 127.0.0.1 ──> daemon
                                             ├── vault files
                                             ├── SQLite application data
                                             └── host Git credentials ──> remote
```

The Git remote is an external data destination, not a remote daemon endpoint.
The lockfile token is never sent to the Git remote.

## Decision: keep the daemon local-only

The daemon binds to `127.0.0.1` on port `7274` by default. `PORT` can override
the port for local development or service configuration, but the bind address
remains loopback.

This keeps the API out of the network threat model and makes the deployment
simple. Devices synchronize through Git remotes rather than connecting to a
remote obsync daemon. A token is defense in depth, not a reason to expose the
daemon port.

## Decision: use a per-session token and lockfile

After the HTTP server starts, the daemon generates a fresh random token and
writes `daemon.json` with the token, process ID, and configured port:

```json
{
  "token": "...",
  "pid": 12345,
  "port": 7274
}
```

The CLI reads the lockfile once per invocation, checks that the recorded PID is
alive, and sends the token as `Authorization: Bearer <token>`. Requests without
the current token receive `401`. `--daemon-url` and `OBSYNC_DAEMON_URL` can
override the URL while the lockfile token remains the credential.

The default lockfile locations are:

- Linux/BSD: `$XDG_DATA_HOME/obsync/daemon.json` when `XDG_DATA_HOME` is absolute; otherwise `~/.local/share/obsync/daemon.json`
- macOS: `~/Library/Application Support/obsync/daemon.json`
- Windows: `%LOCALAPPDATA%\obsync\daemon.json`, falling back to `%USERPROFILE%\AppData\Local\obsync\daemon.json`

The daemon removes the lockfile on clean shutdown. At startup it uses the
configured port and lockfile metadata to detect another live daemon and remove
corrupt or stale lockfiles. This is a liveness check, not a kernel-level file
lock.

The current writer does not explicitly set mode `600`; the lockfile must be
treated as a secret and protected by the host’s per-user data-directory
permissions. A process that can read it can authenticate as the current daemon
session.

## Decision: protect the integrity of a shared mutable vault

The daemon does not assume it is the only actor modifying a vault. Files may be
changed by Obsidian, an editor, a shell Git command, a Git hook, another local
process, or another obsync invocation. These actors can interleave with a sync
even when the daemon’s own requests are serialized.

The implementation limits races within the operations it controls:

- `SyncQueue` serializes Git work per vault.
- A partial unique database index allows only one `queued` or `running` sync operation per vault.
- Conditional state updates prevent stale workers from advancing an operation.
- Vault edits and deletion are blocked while sync work is active.
- Startup reconciliation aborts operations left behind by a crashed daemon.
- Git dirty-tree and merge-conflict errors are surfaced instead of silently overwritten.

These safeguards protect obsync’s operation and database state; they are not an
exclusive filesystem lock. External processes can still change files between
Git phases, so the daemon relies on Git’s own checks and reports conflicts or
dirty working trees to the user.

## Decision: delegate credentials to host Git

obsync does not implement its own credential store. `GitService` is the single
boundary for Git operations and delegates authentication to the host Git
configuration, SSH keys, SSH agents, and credential helpers.

This avoids duplicating credential storage and lets existing Git security
controls apply. It also means Git credentials and remote policy remain the
operator’s responsibility.

## Decision: validate at the HTTP and persistence boundaries

The daemon applies Zod schemas through `nestjs-zod` and maps failures to typed
application errors. Vault paths must be absolute and cannot contain `.` or `..`
segments. Database access uses Drizzle’s parameterized query APIs.

Remote URLs are resolved from the repository at runtime rather than copied into
the vault registry. This keeps `.git/config` as the source of truth, but remote
URL schemes are still supplied by Git configuration and are not an obsync
credential or sandbox boundary.

## Consequences and limitations

- Local same-user malware is not stopped if it can read the lockfile or directly access the vault.
- The daemon is intentionally not a remote API server; exposing it beyond loopback is unsupported.
- Vault names are the CLI-facing route identifiers; database UUIDs remain internal persistence keys.
- The current sync flow records merge conflicts for later handling. The `stash-and-retry` strategy and a conflict-resolution API are not complete.
- Vault configuration stores `autoSync` and `syncInterval`, but current execution is manual; there is no active scheduler in the daemon.
