# Security

## Scope

obsync is a **local-only tool**. The daemon runs exclusively on your local machine (`127.0.0.1`) alongside your Obsidian vaults. It is not intended for public network exposure or remote daemon binding. Remote synchronization (e.g. to a NAS, VPS, GitHub, or GitLab) is achieved natively via standard Git remotes (SSH / HTTPS).

> ⚠️ **Pre-release notice**: The authentication layer described in this document is **not yet implemented**. See [Current status](#current-status) below.

---

## Threat model

The daemon runs locally and manages Git operations on your vault files. The realistic threats for a local deployment are:

| Threat | Mitigation |
| --- | --- |
| Rogue website or cross-origin browser request | CORS restricted to `127.0.0.1` + browser Private Network Access (PNA) + **Per-session Bearer token auth** (forces CORS preflight and rejects unauthenticated requests) |
| Stray local process calling the daemon | **Per-session Bearer token auth** _(planned — Phase 2)_ |
| Malware on the same user account | If it can read your lockfile token file (`~/.config/obsync/daemon.json`), it already has direct access to your vault files — the daemon adds no meaningful extra attack surface |

Stronger mechanisms (mTLS, Unix Domain Sockets) are intentionally out of scope for the local threat model. The effort is better spent on input validation.

---

## Designed security controls (local deployment)

### Per-session token authentication _(Phase 2)_

On startup, the daemon generates a random token and writes a lockfile:

```json
// ~/.config/obsync/daemon.json  (mode 600, owned by current user)
{
  "port": 38291,
  "token": "...",
  "pid": 12345
}
```

- Token is generated fresh on every daemon start and deleted on clean shutdown.
- CLI reads the lockfile before every request and sends the token as `Authorization: Bearer <token>`.
- Requiring a custom `Authorization` header forces web browsers to issue a CORS preflight (`OPTIONS`) request on any cross-origin fetch attempt, blocking unauthorized browser tabs.
- Daemon validates via a NestJS guard — requests without a valid token are rejected with `401`.
- CLI validates the `pid` in the lockfile before connecting to detect stale lockfiles left by a crashed daemon.

### Port binding

- Local daemon: binds to `127.0.0.1` only (not reachable from other machines on the network).
- Port is assigned by the OS (port 0) and written to the lockfile — no hardcoded port assumption in the CLI.

> ⚠️ Not yet implemented. Currently binds to a fixed port (default `3000`) with no token auth. See [Current status](#current-status).

### CORS

- Restricted to `127.0.0.1` to block cross-origin browser responses.

---

## Remote synchronization & NAS security

obsync relies on standard Git transport security for remote syncing:

- **SSH Remotes (`git@your-nas:vault.git`)**: Leverages your system's SSH keys (`~/.ssh/id_*`) and SSH config.
- **HTTPS Remotes**: Uses system Git credential helpers (macOS Keychain, Git Credential Manager, SSH agent).
- **Self-Hosted NAS**: Run a standard Git server (e.g. Gitea, bare Git repository over SSH) on your NAS. `obsync-daemon` runs locally on your workstation/laptop and syncs to your NAS via native Git commands.

---

## Input validation _(post-MVP)_

The daemon touches the filesystem and runs Git operations. Surfaces to harden (tracked for a future hardening pass):

- **Path traversal**: vault paths must not escape their expected directory via `../`
- **Git remote URLs**: validate scheme — `file:///etc/passwd` as a remote is a real vector
- **Vault IDs**: sanitize before use in any shell-adjacent context
- **DB inputs**: Drizzle parameterized queries cover most of this; audit any dynamic query construction

---

## Current status

| Control | Status |
| --- | --- |
| CORS restricted to `127.0.0.1` | ✅ Implemented |
| Daemon bound to `127.0.0.1` | ✅ Implemented |
| Per-session token auth (lockfile + guard) | ❌ Not yet implemented — Phase 2 |
| OS-assigned ephemeral port (port 0) | ❌ Not yet — fixed port `3000` |
| Lockfile PID validation | ❌ Not yet — Phase 2 |
| Remote NAS sync via Git remotes (SSH/HTTPS) | ✅ Supported natively by Git |
| Input validation hardening | ❌ Post-MVP |

**Until Phase 2 lands, do not expose the daemon port to any network interface.** It is unauthenticated.

---

## Reporting a vulnerability

This project is pre-release and not publicly listed. If you somehow found something and feel like telling me about it, shoot me an email at <tetsureign@gmail.com> — I'd genuinely appreciate it.
