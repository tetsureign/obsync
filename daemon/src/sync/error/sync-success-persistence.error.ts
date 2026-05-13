import { LogOnlyError } from '@/common/errors/log-only.error';

export class SyncSuccessPersistenceError extends LogOnlyError {
  constructor(vaultId: string, syncOperationId: string, details?: unknown) {
    super(
      `Sync operation ${syncOperationId} for vault ${vaultId} could not be marked successful`,
      'SYNC_SUCCESS_PERSISTENCE_ERROR',
      {
        vaultId,
        syncOperationId,
        details,
      },
    );
  }
}
