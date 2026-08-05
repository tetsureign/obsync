# systemd Service — Phase 2 Hardening Edits

> Companion to `daemon-hardening.md`. Tracks the exact changes required in
> `deploy/obsync-daemon.service` as each security safeguard is implemented.
> Reference `daemon-hardening.md` for full design rationale.

---

## Current state (Phase 1)

Fixed port `3000`, no auth, no lockfile. `PORT` env var is baked into the unit:

```ini
Environment=PORT=3000
Environment=DB_FILE_NAME=file:%h/.local/share/obsync/obsync.db
```

---

## Phase 2.1 — Port 0 binding + lockfile write

**Daemon change** (`main.ts`): bind to port 0 → OS assigns a free port → daemon
writes `~/.config/obsync/daemon.json` with `{ port, token, pid }`.

**Service file change**: remove the hardcoded `PORT` env var. The daemon now
picks its own port dynamically — passing `PORT=3000` via the unit would override
that and break the intent.

```diff
-Environment=PORT=3000
```

No other service file changes. The lockfile path (`~/.config/obsync/daemon.json`)
is written by the daemon itself using `env-paths`; the unit doesn't need to know
about it.

---

## Phase 2.4 — `env-paths` + production DB path

**Daemon change**: daemon resolves the DB path at runtime via `env-paths`
(`~/.local/share/obsync/obsync.db` on Linux) instead of reading `DB_FILE_NAME`.

**Service file change**: remove the `DB_FILE_NAME` env var. Once the daemon
uses `env-paths` for production path resolution, passing `DB_FILE_NAME` via
the unit is redundant and may conflict with the daemon's own logic.

```diff
-Environment=DB_FILE_NAME=file:%h/.local/share/obsync/obsync.db
```

> Keep `WorkingDirectory=%h/.local/share/obsync` — Drizzle's migrator still
> resolves `drizzle/` relative to CWD at startup.

---

## Final state (post-Phase 2)

After both changes, the `[Service]` section simplifies to:

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

---

## Out of scope for the service file

These Phase 2 items are **daemon-only changes** — the unit file does not change:

- Auth guard (NestJS guard validates `Authorization: Bearer` — internal to daemon)
- Lockfile delete on shutdown (`OnApplicationShutdown` hook — internal to daemon)
- `config.toml` loading (post-MVP, internal to daemon `ConfigModule`)
