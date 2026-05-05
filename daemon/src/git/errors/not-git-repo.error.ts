import { AppError } from '@/common/errors/app.error';

export class NotAGitRepoError extends AppError {
  constructor(path: string) {
    super(
      `The path "${path}" is not a valid Git repository.`,
      'NOT_A_GIT_REPO',
      400,
      {
        path,
      },
    );
  }
}
