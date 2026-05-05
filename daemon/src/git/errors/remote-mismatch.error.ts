import { AppError } from '@/common/errors/app.error';

export class RemoteMismatchError extends AppError {
  constructor(localPath: string, expected: string, actual: string | undefined) {
    super(
      actual
        ? `The remote URL "${actual}" at path "${localPath}" does not match the expected URL "${expected}".`
        : `No remote URL found at path "${localPath}"`,
      'REMOTE_MISMATCH',
      400,
      {
        localPath,
        expected,
        actual,
      },
    );
  }
}
