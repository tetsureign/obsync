# Daemon Hardening & Configuration — Remaining Work

> Shipped and documented elsewhere: per-session token auth + lockfile
> (SECURITY.md, ARCHITECTURE.md), in-repo path resolution
> (`daemon/src/common/utils/app-paths.ts` mirrored by `cli/src/paths.rs`).
> Threat model table lives in SECURITY.md. This file holds what is **not**
> built yet.

---

## `config.toml` shape (future)

```toml
[daemon]
preferred_port = 7274   # configurable override; fixed default in code
log_level = "info"

[database]
# path = "/custom/path/obsync.db"   # optional override; defaults to platform data dir
```

Most user-facing settings live in the **database** (vault configs, sync
history). `config.toml` is reserved for daemon-level settings that must be
readable before the DB is open.

### DB path priority order

```
config.toml [database.path]  →  explicit override
  else  →  platform data dir / obsync.db
```

(DB_FILE_NAME env var remains a dev/test override until then.)

### Future: ConfigModule

1. Load and parse `<data dir>/config.toml` using a TOML parser (e.g. `@ltd/j-toml`)
2. Merge with defaults; expose daemon settings (port hint, log level)
3. Replaces ad-hoc `ConfigService` `.env` usage for production config

---

## Outstanding hardening

- **Input validation**: path traversal on `localPath`, remote URL scheme
  allow-list, vault ID/path sanitization
- Drop `PORT` from service units once `preferred_port` lands (installer
  templates in `install.sh` are the place to edit)
