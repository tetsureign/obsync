import { AppError } from '@/common/errors/app.error';

export class RemoteAuthError extends AppError {
  constructor(localPath: string, gitMessage: string, operation: string) {
    super(
      `Authentication failed in repository at "${localPath}". Please check your credentials and try again.`,
      'REMOTE_AUTH_ERROR',
      401,
      {
        operation,
        gitMessage,
        localPath,
      },
    );
  }
}
