import { AppError } from '@/common/errors/app.error';

export class SyncOperationPersistenceError extends AppError {
  constructor(vaultId: string, cause: unknown) {
    super(
      `Failed to persist sync operation record for vault: ${vaultId}`,
      'SYNC_OPERATION_PERSISTENCE_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
