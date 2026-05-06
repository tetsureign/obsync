import { AppError } from '@/common/errors/app.error';

export class DirtyWorkingTreeError extends AppError {
  constructor(localPath: string, gitMessage: string, operation: string) {
    super(
      `"${localPath}" is dirty. Please commit your changes or stash them and try again.`,
      'DIRTY_WORKING_TREE_ERROR',
      409,
      {
        operation,
        gitMessage,
        localPath,
      },
    );
  }
}
