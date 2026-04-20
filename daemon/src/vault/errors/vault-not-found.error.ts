import { AppError } from '@/common/errors/app.error';

export class VaultNotFoundError extends AppError {
  constructor(id: string) {
    super(`Vault ${id} not found`, 'VAULT_NOT_FOUND', 404, { id });
  }
}
