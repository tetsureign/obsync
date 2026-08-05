# systemd Service — Phase 2 Hardening Edits

> Companion to `daemon-hardening.md`. Tracks the exact changes required in
> `deploy/obsync-daemon.service` as each security safeguard is implemented.
> Reference `daemon-hardening.md` for full design rationale.

---

## Current state (Phase 1)

Fixed default port `7274`, no auth, no lockfile. `PORT` env var is set in the unit:

```ini
Environment=NODE_ENV=production
Environment=PORT=7274
Environment=DB_FILE_NAME=file:%h/.local/share/obsync/obsync.db
```

Port override (until `ConfigModule` lands): use a systemd drop-in —
`systemctl --user edit obsync-daemon.service` and set `Environment=PORT=8080`.
When `config.toml` is implemented, `preferred_port` there is the canonical override path.

---

## Phase 2.1 — Lockfile write on startup (token + pid)

**Daemon change** (`main.ts`): on startup, generate a random bearer token and write
`~/.config/obsync/daemon.json` with `{ token, pid }`. Port is **not** in the lockfile
— it remains fixed at `7274` (or whatever `PORT` env var / `config.toml` specifies).

**Service file change**: none. `PORT=7274` stays in the unit. The lockfile introduces
auth, not port discovery.

---

## Phase 2.4 — `env-paths` + production DB path + ConfigModule

**Daemon change**: daemon resolves the DB path at runtime via `env-paths`
(`~/.local/share/obsync/obsync.db` on Linux) instead of reading `DB_FILE_NAME`.
The `ConfigModule` also reads `~/.config/obsync/config.toml`, which provides
`preferred_port` as the canonical user override for the port.

**Service file changes**:
- Drop `Environment=DB_FILE_NAME=...` — daemon resolves this internally.
- Drop `Environment=PORT=7274` — daemon reads `preferred_port` from `config.toml`,
  falling back to the hardcoded default in code. No need for the unit to set it.

```diff
-Environment=PORT=7274
-Environment=DB_FILE_NAME=file:%h/.local/share/obsync/obsync.db
```

> Keep `WorkingDirectory=%h/.local/share/obsync` — Drizzle's migrator still
> resolves `drizzle/` relative to CWD at startup.

---

## Final state (post-Phase 2)

After Phase 2.4 (`DB_FILE_NAME` and `PORT` both dropped — resolved via `env-paths`
and `config.toml` respectively), the `[Service]` section simplifies to:

```ini
[Service]
Type=simple
ExecStart=%h/.local/bin/obsync-daemon
WorkingDirectory=%h/.local/share/obsync

Environment=NODE_ENV=production

Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60s
StartLimitBurst=5

NoNewPrivileges=true
PrivateTmp=true
```

Port and DB path are fully owned by the daemon's own config/path resolution.

---

## Out of scope for the service file

These Phase 2 items are **daemon-only changes** — the unit file does not change:

- Auth guard (NestJS guard validates `Authorization: Bearer` — internal to daemon)
- Lockfile delete on shutdown (`OnApplicationShutdown` hook — internal to daemon)
- `config.toml` loading (post-MVP, internal to daemon `ConfigModule`)
