import { AppError } from '@/common/errors/app.error';

// TODO: Integrate with ConflictModule
export class MergeConflictError extends AppError {
  constructor(localPath: string, gitMessage: string, operation: string) {
    super(`Merge conflict in ${localPath}`, 'MERGE_CONFLICT', 409, {
      operation,
      gitMessage,
      localPath,
    });
  }
}
