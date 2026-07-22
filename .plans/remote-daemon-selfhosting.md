# Remote Daemon Self-Hosting & Security Specifications

> Captured from a design session on 2026-07-22.
> Details security requirements, networking, and deployment templates for self-hosting `obsync-daemon` on remote servers, NAS hardware, or homelabs.

---

## Overview

While local deployments rely on an ephemeral local lockfile (`~/.config/obsync/daemon.json`), running `obsync-daemon` on a remote server, VPS, or NAS requires persistent authentication, explicit networking configuration, and transport-level security.

---

## 1. Threat Model & Security Controls

Exposing a daemon over a network (`0.0.0.0`) introduces remote attack vectors. The following security controls are required for remote deployments:

### A. Persistent API Key Authentication
- **Mechanism**: Remote daemons accept a persistent secret key configured via the `OBSYNC_API_KEY` environment variable or `config.toml`.
- **Enforcement**: All incoming HTTP requests must include:
  ```http
  Authorization: Bearer <OBSYNC_API_KEY>
  ```
- **Rejection**: Requests missing or possessing an invalid token receive an immediate `401 Unauthorized` response.

### B. Transport Encryption (TLS / VPN)
- **Requirement**: Plaintext HTTP exposes the bearer token to network sniffing on local or public networks.
- **Deployment Options**:
  1. **Tailscale / WireGuard (Recommended for Homelabs)**: Binds the daemon interface or container to a private mesh VPN IP (`100.x.y.z`). No public ports exposed.
  2. **Reverse Proxy (Caddy / Nginx / Traefik)**: Terminates TLS with Let's Encrypt for domain access (`https://obsync.example.com`).

### C. Host Binding & Fixed Port
- **Binding**: Set `HOST=0.0.0.0` to listen on all network interfaces inside a container or remote host.
- **Port**: Use a fixed port (default `3000`) specified via `PORT=3000` rather than random ephemeral port 0, ensuring clients have a stable network target.

### D. CORS & Host Header Protection
- **CORS**: Disable cross-origin browser requests (`origin: false`) by default to block malicious browser `fetch()` calls.
- **DNS Rebinding**: Validate incoming `Host` headers against allowed domains or IPs.

---

## 2. File Ownership & Permissions (PUID / PGID)

To prevent root-owned files inside mounted Obsidian vault directories:

- Support non-root execution inside Docker containers.
- Accept `PUID` (Process User ID) and `PGID` (Process Group ID) environment variables so file writes and Git operations preserve host file permissions (e.g., `1000:1000`).

---

## 3. Production Deployment Templates

### `.env.example`
```env
# Network & Security
HOST=0.0.0.0
PORT=3000
OBSYNC_API_KEY=replace_with_a_secure_random_token

# User Permissions
PUID=1000
PGID=1000

# File Paths
VAULT_DIR=/home/user/Documents/Obsidian
SSH_KEY_DIR=/home/user/.ssh
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  obsync-daemon:
    image: ghcr.io/yourusername/obsync-daemon:latest
    container_name: obsync-daemon
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      # Obsidian Vault Mount
      - ${VAULT_DIR}:/vaults
      # Git SSH Credentials (Read-Only)
      - ${SSH_KEY_DIR:-~/.ssh}:/root/.ssh:ro
      # Persistent SQLite Database & Configuration
      - obsync-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  obsync-data:
```
