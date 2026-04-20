import { AppError } from '@/common/errors/app.error';

export class VaultAlreadyExistsError extends AppError {
  constructor(name: string) {
    super(
      `Vault with name "${name}" already exists`,
      'VAULT_ALREADY_EXISTS',
      409,
      {
        name,
      },
    );
  }
}
