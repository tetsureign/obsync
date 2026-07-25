import { AppError } from '@/common/errors/app.error';

export class VaultNotFoundError extends AppError {
  constructor(identifier: string) {
    super(`Vault '${identifier}' not found`, 'VAULT_NOT_FOUND', 404, {
      identifier,
    });
  }
}
