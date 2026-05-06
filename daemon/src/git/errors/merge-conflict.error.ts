import { AppError } from '@/common/errors/app.error';

// TODO: More detailed error message with instructions on how to resolve the conflict?
export class MergeConflictError extends AppError {
  constructor(localPath: string, gitMessage: string, operation: string) {
    super(`Merge conflict in ${localPath}`, 'MERGE_CONFLICT', 409, {
      operation,
      gitMessage,
      localPath,
    });
  }
}
