import { AppError } from '@/common/errors/app.error';

export class SyncNothingQueuedError extends AppError {
  constructor(vaultName: string) {
    super(
      `No queued sync operation to abort for vault ${vaultName}`,
      'SYNC_NOTHING_QUEUED',
      400,
    );
  }
}
