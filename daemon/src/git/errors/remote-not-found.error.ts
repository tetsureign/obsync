import { AppError } from '@/common/errors/app.error';

export class RemoteNotFoundError extends AppError {
  constructor(localPath: string, remoteAlias: string) {
    super(
      `No remote URL found at path "${localPath}" for remote alias "${remoteAlias}".`,
      'REMOTE_NOT_FOUND',
      404,
      {
        localPath,
        remoteAlias,
      },
    );
  }
}
