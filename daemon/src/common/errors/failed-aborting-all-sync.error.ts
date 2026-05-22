import { AppError } from '@/common/errors/app.error';

export class FailedAbortingAllSyncOperations extends AppError {
  constructor(cause: unknown) {
    super(
      `Failed to abort all active sync operations on application bootstrap`,
      'FAILED_ABORTING_ALL_SYNC_OPERATIONS',
      500,
      {
        cause,
      },
    );
  }
}
