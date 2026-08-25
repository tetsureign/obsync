import { homedir } from 'os';
import { isAbsolute, join } from 'path';

const APP_NAME = 'obsync';

/**
 * Resolves obsync's on-disk data directory.
 *
 * This is obsync's single source of truth for filesystem locations and must
 * stay mirrored by cli/src/paths.rs — golden-value tests on both sides pin
 * the same literals.
 */
export function resolveAppDataDir(
  platform: NodeJS.Platform,
  home: string,
  env: { XDG_DATA_HOME?: string; LOCALAPPDATA?: string },
): string {
  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_NAME);
    case 'win32':
      return join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), APP_NAME);
    default: {
      // XDG Base Directory spec (Linux, BSDs); non-absolute overrides ignored
      const xdg = env.XDG_DATA_HOME;
      return join(
        xdg && isAbsolute(xdg) ? xdg : join(home, '.local', 'share'),
        APP_NAME,
      );
    }
  }
}

export const appDataDir = resolveAppDataDir(
  process.platform,
  homedir(),
  process.env,
);
