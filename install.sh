#!/bin/sh
# obsync installer/updater (POSIX sh).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/tetsureign/obsync/master/install.sh | sh
#
# Installs the obsync CLI and the obsyncd daemon from the latest GitHub release
# into ~/.local/bin and registers a background service (systemd user unit on
# Linux, LaunchAgent on macOS). Safe to re-run at any time to update: binaries
# are swapped and the service is restarted. Never touches vaults or app data.
#
# Options:
#   --version <tag>   Install a specific release (e.g. --version v0.2.0).
#                     Defaults to the latest published release.
#   --bin-dir <dir>   Binary install location (default ~/.local/bin)
#   --data-dir <dir>  Daemon data/migrations location (default ~/.local/share/obsync)
#   --no-service      Do not register/start the background service
set -eu

GITHUB="https://github.com/tetsureign/obsync"
BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.local/share/obsync"
VERSION=""
SERVICE=1

SERVICE_NAME="obsyncd"
LAUNCHD_LABEL="io.github.tetsureign.obsyncd"

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      [ $# -ge 2 ] || die "--version requires a tag"
      VERSION="$2"; shift 2 ;;
    --bin-dir)
      [ $# -ge 2 ] || die "--bin-dir requires a directory"
      BIN_DIR="$2"; shift 2 ;;
    --data-dir)
      [ $# -ge 2 ] || die "--data-dir requires a directory"
      DATA_DIR="$2"; shift 2 ;;
    --no-service)
      SERVICE=0; shift ;;
    -h|--help)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      die "unknown option: $1 (see --help)" ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || [ "$(uname -s)" = "Linux" ] ||
  die "unsupported OS '$(uname -s)'. This installer covers POSIX systems only."

OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}/${ARCH}" in
  Darwin/arm64|Darwin/aarch64)
    CLI_TARGET="aarch64-apple-darwin"; DAEMON_PLATFORM="macos-arm64" ;;
  Darwin/x86_64|Darwin/amd64)
    CLI_TARGET="x86_64-apple-darwin"; DAEMON_PLATFORM="macos-x64" ;;
  Linux/aarch64|Linux/arm64)
    CLI_TARGET="aarch64-unknown-linux-gnu"; DAEMON_PLATFORM="linux-arm64" ;;
  Linux/x86_64|Linux/amd64)
    CLI_TARGET="x86_64-unknown-linux-gnu"; DAEMON_PLATFORM="linux-x64" ;;
  *)
    die "unsupported architecture '${ARCH}' on ${OS}" ;;
esac

fetch() {
  # fetch <url> <output-file>
  if command -v curl >/dev/null 2>&1; then
    curl -fSL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$2" "$1"
  else
    die "need curl or wget to download files"
  fi
}

resolve_latest_tag() {
  # Follow the /releases/latest redirect; no API token or jq needed.
  location=""
  if command -v curl >/dev/null 2>&1; then
    location=$(curl -fsSI "${GITHUB}/releases/latest" | grep -i '^location:' || true)
  elif command -v wget >/dev/null 2>&1; then
    location=$(wget --server-response --spider "${GITHUB}/releases/latest" 2>&1 | grep -i '^ *Location:' || true)
  fi
  [ -n "$location" ] ||
    die "could not resolve the latest release (network issue?)"
  echo "$location" | grep -q '/tag/' ||
    die "no published releases found yet."
  echo "$location" | sed 's#.*/tag/##' | tr -d '\r\n'
}

if [ -z "$VERSION" ]; then
  VERSION="$(resolve_latest_tag)"
  log "Latest release: ${VERSION}"
else
  log "Installing pinned version: ${VERSION}"
fi

BASE_URL="${GITHUB}/releases/download/${VERSION}"
CLI_ASSET="obsync-${CLI_TARGET}.tar.gz"
DAEMON_ASSET="obsyncd-${DAEMON_PLATFORM}.tar.gz"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

log "Downloading ${CLI_ASSET} ..."
fetch "${BASE_URL}/${CLI_ASSET}" "${TMP_DIR}/${CLI_ASSET}"
fetch "${BASE_URL}/${CLI_ASSET}.sha256" "${TMP_DIR}/${CLI_ASSET}.sha256"
log "Downloading ${DAEMON_ASSET} ..."
fetch "${BASE_URL}/${DAEMON_ASSET}" "${TMP_DIR}/${DAEMON_ASSET}"
fetch "${BASE_URL}/${DAEMON_ASSET}.sha256" "${TMP_DIR}/${DAEMON_ASSET}.sha256"

verify_sha256() {
  # verify_sha256 <file>
  expected=$(cut -d' ' -f1 "${TMP_DIR}/$(basename "$1").sha256" | tr 'A-Z' 'a-z')
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$1" | cut -d' ' -f1)
  elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$1" | cut -d' ' -f1)
  else
    die "need sha256sum or shasum to verify checksums"
  fi
  [ "$actual" = "$expected" ] ||
    die "checksum mismatch for $(basename "$1") (expected ${expected}, got ${actual})"
}

log "Verifying checksums ..."
verify_sha256 "${TMP_DIR}/${CLI_ASSET}"
verify_sha256 "${TMP_DIR}/${DAEMON_ASSET}"

mkdir -p "${TMP_DIR}/cli" "${TMP_DIR}/daemon"
tar -xzf "${TMP_DIR}/${CLI_ASSET}" -C "${TMP_DIR}/cli"
tar -xzf "${TMP_DIR}/${DAEMON_ASSET}" -C "${TMP_DIR}/daemon"

[ -f "${TMP_DIR}/cli/obsync" ] || die "CLI archive did not contain 'obsync'"
[ -f "${TMP_DIR}/daemon/obsyncd" ] || die "daemon archive did not contain 'obsyncd'"
[ -d "${TMP_DIR}/daemon/drizzle" ] || die "daemon archive did not contain 'drizzle/'"

[ "$DATA_DIR" != "/" ] || die "refusing to use / as data dir"
mkdir -p "$BIN_DIR" "$DATA_DIR"

mv -f "${TMP_DIR}/cli/obsync" "${BIN_DIR}/obsync"
mv -f "${TMP_DIR}/daemon/obsyncd" "${BIN_DIR}/obsyncd"
chmod 0755 "${BIN_DIR}/obsync" "${BIN_DIR}/obsyncd"
rm -rf "${DATA_DIR}/drizzle"
mv "${TMP_DIR}/daemon/drizzle" "${DATA_DIR}/drizzle"

log ""
log "Installed ${VERSION}:"
log "  ${BIN_DIR}/obsync   (CLI)"
log "  ${BIN_DIR}/obsyncd  (daemon)"
log "  ${DATA_DIR}/drizzle (daemon migrations)"

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    log ""
    log "NOTE: ${BIN_DIR} is not in your PATH."
    case "$BIN_DIR" in
      "$HOME"/*) DISPLAY_BIN_DIR="\${HOME}${BIN_DIR#"$HOME"}" ;;
      *) DISPLAY_BIN_DIR="$BIN_DIR" ;;
    esac
    case "${SHELL:-}" in
      *zsh)
        RC_FILE="~/.zshrc"
        EXPORT_LINE="export PATH=\"${DISPLAY_BIN_DIR}:\$PATH\"" ;;
      *bash)
        RC_FILE="~/.bashrc"
        EXPORT_LINE="export PATH=\"${DISPLAY_BIN_DIR}:\$PATH\"" ;;
      *fish)
        RC_FILE="~/.config/fish/config.fish"
        EXPORT_LINE="fish_add_path ${DISPLAY_BIN_DIR}" ;;
      *)
        RC_FILE="~/.profile"
        EXPORT_LINE="export PATH=\"${DISPLAY_BIN_DIR}:\$PATH\"" ;;
    esac
    log "      Add the CLI to your PATH by adding this to ${RC_FILE}:"
    log "        ${EXPORT_LINE}"
    ;;
esac

# ---------------------------------------------------------------------------
# Service registration
# ---------------------------------------------------------------------------

setup_service_systemd() {
  UNIT_DIR="${HOME}/.config/systemd/user"
  UNIT_FILE="${UNIT_DIR}/${SERVICE_NAME}.service"

  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_FILE" <<EOF
[Unit]
Description=obsync daemon - Obsidian vault sync service
Documentation=https://github.com/tetsureign/obsync
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/${SERVICE_NAME}
WorkingDirectory=${DATA_DIR}
Environment=NODE_ENV=production
Environment=PORT=7274

Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60s
StartLimitBurst=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=default.target
EOF

  if ! systemctl --user daemon-reload >/dev/null 2>&1; then
    log "NOTE: wrote ${UNIT_FILE} but systemd user session is unavailable;"
    log "      start manually later with: systemctl --user daemon-reload && systemctl --user enable --now ${SERVICE_NAME}"
    return 0
  fi

  if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl --user restart "$SERVICE_NAME"
    log "Service restarted with the new version."
  else
    systemctl --user enable --now "$SERVICE_NAME"
    log "Service registered and started (runs at login)."
  fi

  # Without lingering the daemon only runs while a login session exists.
  if ! loginctl enable-linger "$(id -un)" >/dev/null 2>&1; then
    log "NOTE: to also start at boot without login, run: sudo loginctl enable-linger $(id -un)"
  fi
}

setup_service_launchd() {
  PLIST_DIR="${HOME}/Library/LaunchAgents"
  PLIST_FILE="${PLIST_DIR}/${LAUNCHD_LABEL}.plist"
  LOG_DIR="${HOME}/Library/Logs"
  GUI_DOMAIN="gui/$(id -u)"

  mkdir -p "$PLIST_DIR" "$LOG_DIR"
  cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${BIN_DIR}/${SERVICE_NAME}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${DATA_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>

  <!-- Restart=on-failure equivalent -->
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>5</integer>

  <!-- Start now and at every login -->
  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/obsyncd.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/obsyncd.err.log</string>
</dict>
</plist>
EOF

  # bootout first: covers both fresh installs and updates of a loaded agent.
  # An immediate re-bootstrap can race launchd's teardown, so retry briefly.
  if ! launchctl bootout "${GUI_DOMAIN}/${LAUNCHD_LABEL}" >/dev/null 2>&1; then
    :
  fi
  ok=0
  i=0
  while [ "$i" -lt 5 ]; do
    if launchctl bootstrap "$GUI_DOMAIN" "$PLIST_FILE" >/dev/null 2>&1; then
      ok=1
      break
    fi
    i=$((i + 1))
    sleep 1
  done
  if [ "$ok" = 1 ]; then
    log "LaunchAgent registered and started (runs at login)."
  else
    log "NOTE: wrote ${PLIST_FILE} but could not load it automatically. Run:"
    log "      launchctl bootstrap ${GUI_DOMAIN} ${PLIST_FILE}"
  fi
}

print_manual_service_hints() {
  log ""
  log "Service registration skipped (--no-service). Start manually with:"
  if [ "$OS" = "Linux" ]; then
    log "  cd ${DATA_DIR} && ${BIN_DIR}/${SERVICE_NAME}"
  else
    log "  cd ${DATA_DIR} && ${BIN_DIR}/${SERVICE_NAME}"
    log "or install the LaunchAgent yourself from the docs."
  fi
}

if [ "$SERVICE" = 1 ]; then
  log ""
  log "Setting up background service..."
  if [ "$OS" = "Linux" ]; then
    setup_service_systemd
  else
    setup_service_launchd
  fi
else
  print_manual_service_hints
fi

log ""
log "Useful commands:"
if [ "$OS" = "Linux" ]; then
  log "  systemctl --user status ${SERVICE_NAME}     # daemon logs/state"
  log "  journalctl --user -u ${SERVICE_NAME} -f     # follow daemon logs"
  log "  systemctl --user disable --now ${SERVICE_NAME}   # stop + disable"
else
  log "  tail -f ~/Library/Logs/obsyncd.log          # follow daemon logs"
  log "  launchctl kickstart -k gui/\$(id -u)/${LAUNCHD_LABEL}   # restart"
  log "  launchctl bootout gui/\$(id -u)/${LAUNCHD_LABEL}        # stop"
fi
log ""
log "Re-run this script anytime to update (--version <tag> to pin)."
