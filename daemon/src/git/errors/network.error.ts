import { AppError } from '@/common/errors/app.error';

export class NetworkError extends AppError {
  constructor(localPath: string, gitMessage: string, operation: string) {
    super(
      `Network error occurred in repository at "${localPath}". Please check your network connection and try again.`,
      'NETWORK_ERROR',
      503,
      {
        operation,
        gitMessage,
        localPath,
      },
    );
  }
}
