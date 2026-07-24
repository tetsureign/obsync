# Security

## Scope

obsync is currently a **pre-release, local-only tool**. The daemon is designed to run on your own machine and is not intended for public network exposure at this stage.

> ⚠️ **Pre-release notice**: The authentication layer described in this document is **not yet implemented**. See [Current status](#current-status) below.

---

## Threat model

The daemon runs locally and manages Git operations on your vault files. The realistic threats for a local deployment are:

| Threat                                        | Mitigation                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Rogue website fetching from `localhost`       | CORS restricted to `127.0.0.1`                                                                                                 |
| Stray process accidentally hitting the daemon | Per-session token auth _(planned — Phase 2)_                                                                                   |
| Malware on the same user account              | If it can read your token file, it already has direct access to your vault files — the daemon adds no meaningful extra surface |

Stronger mechanisms (mTLS, Unix Domain Sockets) are intentionally out of scope for the local threat model. The effort is better spent on input validation.

---

## Designed security controls (local deployment)

### Per-session token authentication _(Phase 2)_

On startup, the daemon will generate a random token and write a lockfile:

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
- Daemon validates via a NestJS guard — requests without a valid token are rejected with `401`.
- CLI validates the `pid` in the lockfile before connecting, to detect stale lockfiles left by a crashed daemon.

### Port binding

- Local daemon: binds to `127.0.0.1` only (not reachable from other machines on the network).
- Port is assigned by the OS (port 0) and written to the lockfile — no hardcoded port assumption in the CLI.

> ⚠️ Not yet implemented. Currently binds to a fixed port (default `3000`) with no token auth. See [Current status](#current-status).

### CORS

- Restricted to `127.0.0.1` to prevent rogue browser pages from calling the daemon API.

---

## Remote / self-hosted deployments _(Phase 4)_

> ⚠️ Not yet implemented. Remote deployment is planned but not supported in the current release.

Exposing the daemon on a network (e.g., NAS, VPS, homelab) introduces remote attack vectors. The following controls are designed for remote deployments:

### Persistent API key

Remote daemons will accept a persistent secret key configured via `OBSYNC_API_KEY` environment variable. All HTTP requests must include:

```http
Authorization: Bearer <OBSYNC_API_KEY>
```

### Transport encryption

Plaintext HTTP over a network exposes the bearer token to interception. Recommended options:

- **Tailscale / WireGuard** (recommended for homelabs): bind the daemon to a private mesh VPN interface. No public ports exposed.
- **Reverse proxy (Caddy / Nginx / Traefik)**: terminate TLS with Let's Encrypt for domain access.

### Host binding

Remote deployments set `HOST=0.0.0.0` to accept connections from the network. The safe default remains `127.0.0.1`.

### CORS for remote deployments

When binding to `0.0.0.0`, CORS will be set to `origin: false` to block browser cross-origin requests.

---

## Input validation _(post-MVP)_

The daemon touches the filesystem and runs Git operations. Surfaces to harden (tracked for a future hardening pass):

- **Path traversal**: vault paths must not escape their expected directory via `../`
- **Git remote URLs**: validate scheme — `file:///etc/passwd` as a remote is a real vector
- **Vault IDs**: sanitize before use in any shell-adjacent context
- **DB inputs**: Drizzle parameterized queries cover most of this; audit any dynamic query construction

---

## Current status

| Control                                   | Status                           |
| ----------------------------------------- | -------------------------------- |
| CORS restricted to `127.0.0.1`            | ✅ Implemented                   |
| Daemon bound to `127.0.0.1`               | ✅ Implemented                   |
| Per-session token auth (lockfile + guard) | ❌ Not yet implemented — Phase 2 |
| OS-assigned ephemeral port (port 0)       | ❌ Not yet — fixed port `3000`   |
| Lockfile PID validation                   | ❌ Not yet — Phase 2             |
| Remote deployment controls (API key, TLS) | ❌ Not yet — Phase 4             |
| Input validation hardening                | ❌ Post-MVP                      |

**Until Phase 2 lands, do not expose the daemon port to any network interface.** It is unauthenticated.

---

## Reporting a vulnerability

This project is pre-release and not publicly listed. If you somehow found something and feel like telling me about it, shoot me an email at <tetsureign@gmail.com> — I'd genuinely appreciate it.
