import { AppError } from '@/common/errors/app.error';

export class AbortSyncOperationError extends AppError {
  constructor(vaultId: string, cause: unknown) {
    super(
      `Failed to abort all sync operations on vault ${vaultId}`,
      'ABORT_SYNC_OPERATION_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
