import { AppError } from '@/common/errors/app.error';

export class SyncRecordPersistenceError extends AppError {
  constructor(vaultId: string, cause: unknown) {
    super(
      `Failed to persist sync record for vault: ${vaultId}`,
      'SYNC_RECORD_PERSISTENCE_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
