import { AppError } from '@/common/errors/app.error';

export class SyncFailurePersistenceError extends AppError {
  constructor(vaultId: string, syncOperationId: string, details?: unknown) {
    super(
      `Sync operation ${syncOperationId} for vault ${vaultId} could not be marked failed`,
      'SYNC_FAILURE_PERSISTENCE_ERROR',
      500,
      {
        vaultId,
        syncOperationId,
        details,
      },
    );
  }
}
