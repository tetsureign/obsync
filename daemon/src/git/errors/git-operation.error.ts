import { AppError } from '@/common/errors/app.error';

export class GitOperationError extends AppError {
  constructor(errorMessage: string) {
    super(errorMessage, 'GIT_OPERATION_ERROR', 500, {
      errorMessage,
    });
  }
}
