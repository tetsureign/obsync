import { AppError } from '@/common/errors/app.error';

export class SyncOperationIsRunningError extends AppError {
  constructor(vaultId: string) {
    super(
      `A sync operation is currently running for vault with id ${vaultId}`,
      'SYNC_OPERATION_RUNNING',
      409,
    );
  }
}
