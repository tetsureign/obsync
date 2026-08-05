# NAS Git Remote Architecture & Demo Docker Setup

> Details the self-hosting architecture via NAS Git remotes and provides a minimal Docker Compose template for quick local evaluation and demoing.

---

## 1. NAS & Self-Hosting Architecture (Git Remotes)

`obsync-daemon` operates exclusively as a **local service** (`127.0.0.1`) running on your workstation, laptop, or desktop alongside your Obsidian vault files. 

Rather than running a remote daemon server on a NAS or VPS over a network interface:
- **Self-Hosting Model**: Users run a standard Git server (e.g. Gitea, GitLab, or a bare SSH Git repository) on their NAS or homelab server.
- **Synchronization**: `obsync-daemon` executes native Git operations (`git pull`, `git push`) from the local machine directly to the remote Git repository on the NAS over standard SSH or HTTPS transport.

### Advantages
1. **Zero Attack Surface**: The daemon never exposes network ports (`0.0.0.0`) to the local LAN or public Internet.
2. **Native Git Security**: Authentication relies on established SSH keys (`~/.ssh/id_*`) and Git credential helpers.
3. **No File Permission Mismatches**: Files in your local Obsidian vault are written directly by your local user process, eliminating UID/GID permission conflicts.

---

## 2. Minimal Demo Docker Compose

To allow developers and users to quickly try out and demo `obsync-daemon` in a containerized environment without manual Node.js installation, a minimal Docker Compose template is provided.

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  obsync-daemon-demo:
    image: ghcr.io/yourusername/obsync-daemon:latest
    container_name: obsync-daemon-demo
    ports:
      - "7274:7274"
    environment:
      - NODE_ENV=production
      - PORT=7274
    volumes:
      # Mount sample vault directory
      - ./demo-vault:/vaults
      # Persistent SQLite database storage
      - obsync-demo-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7274/health"]
      interval: 15s
      timeout: 3s
      retries: 2

volumes:
  obsync-demo-data:
```

### Usage
```bash
# 1. Spin up demo daemon
docker compose up -d

# 2. Verify health
curl http://127.0.0.1:7274/health
```
