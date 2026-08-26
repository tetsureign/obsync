import { createServer, type Server } from 'http';
import { existsSync, rmSync, writeFileSync } from 'fs';
import {
  daemonLockfilePath,
  isProcessAlive,
  liveDaemonHoldsLockfile,
} from '@/common/utils/daemon-lockfile';

describe('Daemon lockfile', () => {
  let server: Server;
  let port: number;

  const writeLockfile = (contents: Record<string, unknown>) =>
    writeFileSync(daemonLockfilePath(), JSON.stringify(contents));

  const clearLockfile = () => {
    if (existsSync(daemonLockfilePath())) {
      rmSync(daemonLockfilePath(), { force: true });
    }
  };

  beforeAll(async () => {
    server = createServer((req, res) => {
      res.statusCode = req.url === '/health' ? 200 : 404;
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as { port: number }).port;
  });

  afterEach(clearLockfile);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports no holder when the lockfile is absent', async () => {
    await expect(liveDaemonHoldsLockfile()).resolves.toBe(false);
  });

  it('detects a live holder: running pid AND health endpoint answering', async () => {
    writeLockfile({ token: 't', pid: process.pid, port });

    await expect(liveDaemonHoldsLockfile()).resolves.toBe(true);
    expect(existsSync(daemonLockfilePath())).toBe(true);
  });

  it('clears the lockfile when the pid was recycled by another program', async () => {
    // This process is alive but serves nothing on that port — exactly the
    // pid-reuse false positive a bare pid check would misread as "running".
    writeLockfile({ token: 't', pid: process.pid, port: 1 });

    expect(isProcessAlive(process.pid)).toBe(true);
    await expect(liveDaemonHoldsLockfile()).resolves.toBe(false);
    expect(existsSync(daemonLockfilePath())).toBe(false);
  });

  it('cleans up a stale lockfile from a dead pid', async () => {
    // Beyond every default pid_max (Linux 4194304, macOS 99998)
    const deadPid = 5_000_000;
    expect(isProcessAlive(deadPid)).toBe(false);

    writeLockfile({ token: 't', pid: deadPid, port });

    await expect(liveDaemonHoldsLockfile()).resolves.toBe(false);
    expect(existsSync(daemonLockfilePath())).toBe(false);
  });

  it('treats a corrupt lockfile as stale', async () => {
    writeFileSync(daemonLockfilePath(), '{not json');

    await expect(liveDaemonHoldsLockfile()).resolves.toBe(false);
    expect(existsSync(daemonLockfilePath())).toBe(false);
  });
});
