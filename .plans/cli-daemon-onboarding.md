# Unix Installation Script & Daemon Lifecycle Management

> Defines the installation strategy via `install.sh`, native OS background service integration (`systemd` / `launchd`), and CLI runtime daemon probe diagnostics.

---

## Overview

To maintain a lightweight, instantaneous CLI and zero background overhead when idle, `obsync` employs a two-process local model:
- The **daemon** (`obsync-daemon`) runs as a persistent background service managed by the OS init system (`systemd` on Linux, `launchd` on macOS).
- The **CLI** (`obsync`) is a fast, stateless control interface.

Installation and service registration are handled via a Unix installation shell script (`install.sh`), keeping the CLI binary small and free of interactive setup wizard complexity.

---

## 1. Unix Installation Script (`install.sh`)

For Linux and macOS desktop environments, installation is executed via a curl-friendly shell script:

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/obsync/main/install.sh | sh
```

### Installer Actions
1. **System & Architecture Detection**: Identifies OS (`Linux` / `Darwin`) and CPU architecture (`x86_64` / `arm64`).
2. **Binary Placement**: Downloads and installs pre-compiled `obsync` CLI and `obsync-daemon` binaries into `~/.local/bin` (or `/usr/local/bin`).
3. **Background Service Registration**:
   - **Linux (`systemd`)**:
     - Writes user service unit to `~/.config/systemd/user/obsync-daemon.service`.
     - Executes `systemctl --user daemon-reload` and `systemctl --user enable --now obsync-daemon`.
   - **macOS (`launchd`)**:
     - Writes LaunchAgent plist to `~/Library/LaunchAgents/com.obsync.daemon.plist`.
     - Executes `launchctl load -w ~/Library/LaunchAgents/com.obsync.daemon.plist`.
4. **Verification**: Probes `http://127.0.0.1:<port>/health` via lockfile to confirm clean startup.

---

## 2. Runtime Daemon Probe & Offline Diagnostics

When a user executes any `obsync` CLI command (excluding `--help` or `--version`):

1. **Lockfile & Health Probe**:
   - The CLI reads `~/.config/obsync/daemon.json` (mode `600`) to obtain the current ephemeral `port`, `pid`, and `token`.
   - The CLI performs a PID liveness check (`kill(pid, 0)` equivalent) and issues `GET /health` with `Authorization: Bearer <token>`.
2. **Daemon Responsive**: Execution proceeds immediately to the requested subcommand.
3. **Daemon Unreachable**:
   - The CLI prints a clear, non-blocking diagnostic message to `stderr` and exits with a non-zero code. No interactive prompts or wizards are presented.

```text
Error: obsync daemon is not running (checked lockfile at ~/.config/obsync/daemon.json).

To start the background service:
  Linux: systemctl --user start obsync-daemon
  macOS: launchctl load ~/Library/LaunchAgents/com.obsync.daemon.plist

Or install obsync using the setup script:
  curl -fsSL https://raw.githubusercontent.com/.../install.sh | sh
```

---

## 3. Scripting & Batch Execution

To support automated execution in scripts, CI/CD, and Git hooks:

- Non-zero exit code (`1`) is returned immediately when the daemon is unreachable.
- The `--batch` or `--no-interactive` flag ensures output is clean and formatted for non-TTY environments.
