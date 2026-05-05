import { AppError } from '@/common/errors/app.error';

export class RemoteAuthError extends AppError {
  constructor(localPath: string, remoteUrl?: string) {
    super(
      remoteUrl
        ? `Authentication failed for remote "${remoteUrl}" in repository at "${localPath}". Please check your credentials and try again.`
        : `Authentication failed in repository at "${localPath}". Please check your credentials and try again.`,
      'REMOTE_AUTH_ERROR',
      401,
      {
        localPath,
        remoteUrl,
      },
    );
  }
}
