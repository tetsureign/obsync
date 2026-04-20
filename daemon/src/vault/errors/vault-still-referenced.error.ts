import { AppError } from '@/common/errors/app.error';

export class VaultIsStillReferencedError extends AppError {
  constructor(id: string) {
    super(
      `Cannot delete vault ${id} because it is referenced by other records.`,
      'VAULT_STILL_REFERENCED',
      409,
      { id },
    );
  }
}
