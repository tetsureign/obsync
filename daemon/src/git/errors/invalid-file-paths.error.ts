import { AppError } from '@/common/errors/app.error';

export class InvalidFilePathsError extends AppError {
  constructor(
    localPath: string,
    gitMessage: string,
    operation: string,
    filePaths: string[],
  ) {
    super(
      `Failed to ${operation} files in vault at path: ${localPath}. Invalid file paths: ${filePaths.join(', ')}`,
      'INVALID_FILE_PATHS_ERROR',
      400,
      {
        operation,
        gitMessage,
        localPath,
        filePaths,
      },
    );
  }
}
