import { AppError } from '@/common/errors/app.error';

export class VaultAlreadyExistsError extends AppError {
  constructor(name: string, localPath: string) {
    super(
      `Either vault with name "${name}" or path "${localPath}" already exists.`,
      'VAULT_ALREADY_EXISTS',
      409,
      {
        name,
        localPath,
      },
    );
  }
}
