import { describe, expect, it } from 'vitest';
import { resolveAppDataDir } from './app-paths';

const HOME = '/home/testuser';

describe('resolveAppDataDir golden values', () => {
  it('linux: defaults to ~/.local/share/obsync', () => {
    expect(resolveAppDataDir('linux', HOME, {})).toBe(
      `${HOME}/.local/share/obsync`,
    );
  });

  it('linux: honors absolute XDG_DATA_HOME', () => {
    expect(
      resolveAppDataDir('linux', HOME, { XDG_DATA_HOME: '/mnt/data' }),
    ).toBe('/mnt/data/obsync');
  });

  it('linux: ignores relative XDG_DATA_HOME', () => {
    expect(
      resolveAppDataDir('linux', HOME, { XDG_DATA_HOME: 'relative/path' }),
    ).toBe(`${HOME}/.local/share/obsync`);
  });

  it('darwin: uses ~/Library/Application Support/obsync', () => {
    expect(resolveAppDataDir('darwin', '/Users/testuser', {})).toBe(
      '/Users/testuser/Library/Application Support/obsync',
    );
  });

  // Separator handling is delegated to path.join on the target OS; from a
  // non-Windows host we can only pin base selection, not literal output.
  it('win32: prefers %LOCALAPPDATA% as base', () => {
    const dir = resolveAppDataDir('win32', 'C:\\Users\\testuser', {
      LOCALAPPDATA: 'C:\\AppData\\Local',
    });
    expect(dir.startsWith('C:\\AppData\\Local')).toBe(true);
    expect(dir.endsWith('obsync')).toBe(true);
  });

  it('win32: falls back to ~/AppData/Local as base', () => {
    const dir = resolveAppDataDir('win32', 'C:\\Users\\testuser', {});
    expect(dir.startsWith('C:\\Users\\testuser')).toBe(true);
    expect(dir.endsWith('obsync')).toBe(true);
  });
});
