type SqliteWriteResult = {
  changes?: unknown;
  rowsAffected?: unknown;
};

export function getSqliteRowsAffected(result: SqliteWriteResult): number {
  if (typeof result.changes === 'number') {
    return result.changes;
  }

  if (typeof result.rowsAffected === 'number') {
    return result.rowsAffected;
  }

  return 0;
}
