import { existsSync, readFileSync, rmSync } from 'fs';
import { appDataDir } from './app-paths';

const LOCKFILE_NAME = 'daemon.json';
const HEALTH_TIMEOUT_MS = 1_500;

export function daemonLockfilePath(): string {
  return `${appDataDir}/${LOCKFILE_NAME}`;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function isHealthEndpointAlive(port: number): Promise<boolean> {
  return fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

/**
 * Removes a stale lockfile left behind by a crashed daemon. A holder only
 * counts as live when BOTH signals check out: its pid is running AND an HTTP
 * server answers /health on the recorded port — a recycled pid serving some
 * other program does not count.
 */
export async function liveDaemonHoldsLockfile(): Promise<boolean> {
  const path = daemonLockfilePath();
  if (!existsSync(path)) {
    return false;
  }

  let pid: unknown;
  let port: unknown;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      pid?: unknown;
      port?: unknown;
    } | null;
    pid = parsed?.pid;
    port = parsed?.port;
  } catch {
    rmSync(path, { force: true });
    return false;
  }

  if (typeof pid !== 'number' || !isProcessAlive(pid)) {
    rmSync(path, { force: true });
    return false;
  }

  if (
    typeof port !== 'number' ||
    Number.isInteger(port) === false ||
    !(await isHealthEndpointAlive(port))
  ) {
    rmSync(path, { force: true });
    return false;
  }

  return true;
}
