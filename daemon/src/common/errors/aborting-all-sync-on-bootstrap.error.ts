import { AppError } from '@/common/errors/app.error';

export class AbortingAllSyncOnBootstrapError extends AppError {
  constructor(cause: unknown) {
    super(
      `Failed to abort all dangling sync operations on application bootstrap`,
      'ABORTING_ALL_SYNC_ON_BOOTSTRAP_ERROR',
      500,
      {
        cause,
      },
    );
  }
}
