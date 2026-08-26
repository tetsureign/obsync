# Security

## Reporting a vulnerability

Please use this repository’s private vulnerability reporting flow from the
GitHub **Security** tab. Do not open a public issue for a suspected security
vulnerability.

If private reporting is unavailable, email [tetsureign@gmail.com](mailto:tetsureign@gmail.com).
Useful reports include the affected version or commit, reproduction steps,
impact, and the environment in which the issue occurs.

## Scope

obsync is designed for local use. The daemon binds to `127.0.0.1`; remote
synchronization is performed by Git using the vault’s configured remote.
Exposing the daemon on a network interface is unsupported.

For the security architecture, trust boundaries, design rationale, and known
limitations, see [SECURITY_MODEL.md](SECURITY_MODEL.md).

## Running obsync safely

- API requests require the per-session Bearer token written to the daemon’s local lockfile.
- Keep the daemon port local and protect the lockfile as a secret. Anyone who can read it can authenticate to the current daemon session.
- Git credentials are not stored by obsync; the daemon uses the host Git configuration, SSH agent, and credential helpers.
