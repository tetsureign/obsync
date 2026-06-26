import { AppError } from '@/common/errors/app.error';

export class SyncOperationStillRunningError extends AppError {
  constructor(vaultId: string, operation: string) {
    super(
      `A sync operation for vault ${vaultId} is still running. Please wait for it to complete before executing your command.`,
      'SYNC_OPERATION_STILL_RUNNING_ERROR',
      400,
      {
        operation,
      },
    );
  }
}
