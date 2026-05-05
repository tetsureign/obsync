import { AppError } from '@/common/errors/app.error';

export class NetworkError extends AppError {
  constructor(localPath: string, remoteUrl?: string) {
    super(
      remoteUrl
        ? `Network error occurred while accessing remote "${remoteUrl}" in repository at "${localPath}". Please check your network connection and try again.`
        : `Network error occurred in repository at "${localPath}". Please check your network connection and try again.`,
      'NETWORK_ERROR',
      503,
      {
        localPath,
        remoteUrl,
      },
    );
  }
}
