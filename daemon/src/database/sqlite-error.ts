const NODE_SQLITE_ERROR_CODE = 'ERR_SQLITE_ERROR';

// SQLite extended result code for SQLITE_CONSTRAINT_UNIQUE.
// Node exposes this as numeric errcode 2067, not as a symbolic string.
const SQLITE_CONSTRAINT_UNIQUE = 2067;

// SQLite extended result code for SQLITE_CONSTRAINT_FOREIGNKEY.
// Node exposes this as numeric errcode 787, not as a symbolic string.
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

function hasSqliteErrcode(error: unknown, errcode: number): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    'errcode' in error &&
    error.code === NODE_SQLITE_ERROR_CODE &&
    error.errcode === errcode
  );
}

export function isSqliteUniqueConstraintError(error: unknown): boolean {
  return hasSqliteErrcode(error, SQLITE_CONSTRAINT_UNIQUE);
}

export function isSqliteForeignKeyConstraintError(error: unknown): boolean {
  return hasSqliteErrcode(error, SQLITE_CONSTRAINT_FOREIGNKEY);
}
