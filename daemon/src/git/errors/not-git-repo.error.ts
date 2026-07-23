import { AppError } from '@/common/errors/app.error';

export class NotAGitRepoError extends AppError {
  constructor(path: string) {
    super(
      `The path "${path}" is not a valid Git repository. Please initialize first (e.g. run "obsync init" in the directory) or provide a valid Git repository path.`,
      'NOT_A_GIT_REPO',
      400,
      {
        path,
      },
    );
  }
}
