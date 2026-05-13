import { AppError } from '@/common/errors/app.error';

export class SyncQueueRecordPersistenceError extends AppError {
  constructor(vaultId: string, cause: unknown) {
    super(
      `Failed to queue sync operation for vault: ${vaultId}`,
      'SYNC_QUEUE_RECORD_PERSISTENCE_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
