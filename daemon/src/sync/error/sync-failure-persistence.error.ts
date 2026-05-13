import { LogOnlyError } from '@/common/errors/log-only.error';

export class SyncFailurePersistenceError extends LogOnlyError {
  constructor(vaultId: string, syncOperationId: string, details?: unknown) {
    super(
      `Sync operation ${syncOperationId} for vault ${vaultId} could not be marked failed`,
      'SYNC_FAILURE_PERSISTENCE_ERROR',
      {
        vaultId,
        syncOperationId,
        details,
      },
    );
  }
}
