import { AppError } from '@/common/errors/app.error';

export class AbortingAllSyncOperationsError extends AppError {
  constructor(cause: unknown) {
    super(
      `Failed to abort all active sync operations on application bootstrap`,
      'ABORTING_ALL_SYNC_OPERATIONS_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
