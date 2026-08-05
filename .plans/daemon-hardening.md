# Daemon Hardening & Configuration

> Captured from a design session on 2026-05-28.
> Covers CLI↔daemon security, port discovery, and configuration/storage conventions.

---

## Threat Model

The daemon runs locally on the user's machine (`127.0.0.1`). The realistic threats are:

- **Rogue website or cross-origin browser request** → CORS restricted to `127.0.0.1` + browser Private Network Access (PNA) + **per-session token auth** (custom `Authorization` header forces CORS preflight `OPTIONS` check and rejects unauthenticated requests)
- **Stray process** accidentally hitting the daemon → mitigated by per-session token auth (see below)
- **Malware** on the same user account → if it can read the token file (`daemon.json`), it already has direct access to vault files; the daemon adds no meaningful attack surface beyond what's already exposed

Stronger auth mechanisms (mTLS, UDS) are **not worth the complexity** for this threat model.
The effort is better spent on **input validation** (see below).

---

## CLI ↔ Daemon Auth: Per-Session Token

On startup, the daemon generates a random token and writes a lockfile:

```json
// ~/.config/obsync/daemon.json  (mode 600, owned by current user)
{
  "token": "...",
  "pid": 12345
}
```

- File is written on daemon start, deleted on clean shutdown.
- CLI reads it before every request, sends token as `Authorization: Bearer <token>`.
- Daemon validates via a NestJS guard — requests without a valid token are rejected.
- Token rotates on every daemon restart.

The CLI validates the `pid` in the lockfile before connecting (using `kill(pid, 0)` / equivalent)
to detect stale lockfiles left by a crashed daemon.

### Why not stronger auth?

| Option                           | Verdict                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| Unix Domain Socket               | Cross-platform problem: tokio doesn't support UDS on Windows |
| Named Pipes                      | Different APIs per OS; NestJS has no native support          |
| mTLS                             | Massive complexity for zero real-world gain on a local tool  |
| Env var / hardcoded key          | Readable by other processes / visible in open-source repo    |
| **Per-session token file (600)** | ✅ Simple, rotates, good enough for the threat model         |

---

## Port: Fixed Default (`7274`)

The daemon binds to a **fixed default port `7274`**, overridable via `PORT` env var (dev) or
`config.toml` `preferred_port` (production, post-MVP).

**Why not port 0 (OS-assigned)?**
An OS-assigned ephemeral port could later be needed by another application. That app would
fail with an opaque bind error while obsync is the actual culprit — the user has to debug
two tools simultaneously. With a fixed port, any conflict surfaces immediately and obviously
as a daemon startup failure (`EADDRINUSE`), with a single clear fix (change the port).

**Lockfile impact:** the lockfile (`daemon.json`) carries only `{ token, pid }`. The port is
always known; the CLI never needs to discover it from a file.

---

## Input Validation

> **Post-MVP, after CLI is complete.** Tracked here for visibility.

The daemon touches the filesystem and runs Git operations. Key surfaces to harden:

- **Path traversal** — vault paths must resolve inside expected directories; reject any `../` escape
- **Git remote URLs** — validate scheme; `file:///etc/passwd` as a remote is a real vector
- **Vault IDs** — sanitize before use in any shell-adjacent context
- **DB inputs** — Drizzle parameterized queries cover this, but audit any dynamic query construction
- **Sync conflict error paths** — ensure FS is left in a consistent state on failure

---

## Configuration & Storage Conventions

### Directory layout (production)

```
~/.config/obsync/
  config.toml        ← user-editable settings (committed to their dotfiles if they want)
  daemon.json        ← runtime lockfile, ephemeral (gitignored, auto-managed)

~/.local/share/obsync/
  obsync.db          ← SQLite database (Linux/XDG)
```

Windows: `%APPDATA%\obsync\` for config, `%LOCALAPPDATA%\obsync\` for data.
macOS: `~/Library/Application Support/obsync/` for both.

Use [`env-paths`](https://www.npmjs.com/package/env-paths) (Node) in the daemon to resolve
platform-correct paths at runtime:

```ts
import envPaths from "env-paths";
const paths = envPaths("obsync", { suffix: "" });
// paths.config → ~/.config/obsync
// paths.data   → ~/.local/share/obsync
```

### `config.toml` shape

```toml
[daemon]
preferred_port = 7274   # configurable override; fixed default in code
log_level = "info"

[database]
# path = "/custom/path/obsync.db"   # optional override; defaults to platform data dir
```

Most user-facing settings will live in the **database** (vault configs, sync history, etc.).
`config.toml` is reserved for daemon-level settings that must be readable before the DB is open.

### Database path resolution (priority order)

```
config.toml [database.path]  →  explicit override
  else  →  platform data dir / obsync.db   (production)
  else  →  ./local.db                      (NODE_ENV !== 'production')
```

The daemon must `mkdir -p` the data directory on first run before opening the DB.

### Dev ergonomics

- `./local.db` in the daemon project dir stays as-is for development.
- `NODE_ENV` drives the path switch — dev never touches production data.
- `.env` file in the daemon dir is a dev convenience only; production reads from `config.toml`.

---

## Future: ConfigModule

A `ConfigModule` will be scaffolded to:

1. Load and parse `~/.config/obsync/config.toml` using a TOML parser (e.g. `@ltd/j-toml`).
2. Merge with `NODE_ENV`-aware defaults.
3. Resolve and expose the database path.
4. Expose daemon settings (port hint, log level) to the rest of the app.

This replaces the current ad-hoc `ConfigService` `.env` usage for production config.

---

## Implementation Order

> These are all **post-CLI-completion** unless noted.

1. **Lockfile write on startup** (token + pid only; port is fixed) — needed for CLI auth
2. **NestJS auth guard** — validate `Authorization: Bearer` token on all routes
3. **Lockfile delete on shutdown** — NestJS `OnApplicationShutdown` lifecycle hook
4. **`env-paths` integration** — production DB and config path resolution
5. **`config.toml` loading** (`ConfigModule`)
6. **Input validation hardening** (paths, remote URLs, vault IDs)
