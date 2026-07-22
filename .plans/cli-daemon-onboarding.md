# CLI Guided Setup & Daemon Lifecycle Management

> Captured from a design session on 2026-07-22.
> Defines the CLI onboarding flow, runtime daemon detection, and service management strategies (Docker, systemd, launchd, Windows Service).

---

## Overview

To provide a zero-friction "just works" developer experience, the `obsync` Rust CLI includes an interactive first-run onboarding wizard. Users do not need to manually configure background services or write Docker compose files prior to using the CLI.

---

## 1. Runtime Daemon Detection & Probe Strategy

When a user executes any `obsync` CLI command (excluding `--help`, `--version`, or explicit non-daemon utility commands):

1. **Health Probe**: The CLI attempts an HTTP health check (`GET /health` or lockfile read) against the configured daemon address (default `http://127.0.0.1:3000` or lockfile port).
2. **Daemon Responsive**: Execution proceeds immediately to the target subcommand.
3. **Daemon Unreachable**: The CLI intercepts execution and triggers the **Guided Setup Wizard** (unless running in non-interactive mode).

---

## 2. Interactive First-Run Setup Wizard

The setup wizard uses terminal selection prompts (`inquire` or `dialoguer` Rust crates) to present deployment options:

```text
⚠️  No running obsync daemon detected at http://127.0.0.1:3000.

? How would you like to set up the obsync daemon?
  ❯ 1. Native Service (Recommended for local desktop: systemd / launchd / Windows Service)
    2. Docker Container (Recommended for NAS / headless / container environments)
    3. Connect to a Remote Daemon (Existing server or NAS URL)
    4. Skip setup for now
```

### Option A: Native Service Setup
- **Action**:
  1. Downloads or resolves the pre-compiled native daemon executable (Single Executable Application / Node bundle).
  2. Registers and enables the background service for the current OS:
     - **Linux**: Writes systemd user unit to `~/.config/systemd/user/obsync-daemon.service` and executes `systemctl --user enable --now obsync-daemon`.
     - **macOS**: Writes launchd plist to `~/Library/LaunchAgents/com.obsync.daemon.plist` and executes `launchctl load`.
     - **Windows**: Registers service or user Startup task.
  3. Verifies startup via health check probe.

### Option B: Docker Container Setup
- **Action**:
  1. Checks if Docker is installed and running (`docker info`).
  2. Prompts user for Obsidian vault base directory (defaults to auto-detected `~/Documents/Obsidian` or system document path).
  3. Prompts for host port exposure (default `3000`).
  4. Automatically executes container initialization:
     ```bash
     docker run -d \
       --name obsync-daemon \
       --restart unless-stopped \
       -p 3000:3000 \
       -v <HOST_VAULT_DIR>:/vaults \
       -v ~/.ssh:/root/.ssh:ro \
       -v obsync-data:/app/data \
       ghcr.io/yourusername/obsync-daemon:latest
     ```
  5. Verifies container health via HTTP probe.

### Option C: Remote Daemon Setup
- **Action**:
  1. Prompts for remote daemon URL (e.g., `http://192.168.1.50:3000` or `https://obsync.example.com`).
  2. Prompts for persistent API key / bearer token.
  3. Verifies remote connection with a test request.
  4. Saves remote endpoint and credential in `~/.config/obsync/config.toml`.

---

## 3. Path Translation & Mount Awareness

When running in Docker mode, file paths may differ between host and container:

- **Host Mirroring**: For simple setups, mounting host paths directly (`-v /home/user/Obsidian:/home/user/Obsidian`) allows 1:1 path resolution without translation.
- **Base Directory Mapping**: When mounted as `-v /host/path:/vaults`, the CLI/daemon configuration translates host paths under `/host/path` to `/vaults` inside API requests.

---

## 4. Scripting & Non-Interactive Support

To prevent CLI commands from hanging in automated environments (CI/CD, scripts, git hooks):

- Flags `--no-interactive` / `--batch` suppress the wizard and fail immediately with a non-zero exit code if the daemon is unreachable.
- `OBSYNC_DAEMON_URL` environment variable overrides the target daemon URL.
