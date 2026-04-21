import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { UpdateVaultPayload } from '../vault.types';
import { LibsqlError } from '@libsql/client';
import { VaultAlreadyExistsError } from '../errors/vault-already-exists.error';
import { VaultNotFoundError } from '../errors/vault-not-found.error';
import { createUpdateSchema } from 'drizzle-orm/zod';
import { vaults } from '@/database/schema';

export class UpdateVaultCommand {
  constructor(
    public readonly id: UpdateVaultPayload['id'],
    public readonly name?: UpdateVaultPayload['name'],
    public readonly localPath?: UpdateVaultPayload['localPath'],
    public readonly remote?: UpdateVaultPayload['remote'],
    public readonly branch?: UpdateVaultPayload['branch'],
    public readonly autoSync?: UpdateVaultPayload['autoSync'],
    public readonly syncInterval?: UpdateVaultPayload['syncInterval'],
    public readonly conflictStrategy?: UpdateVaultPayload['conflictStrategy'],
  ) {}
}
@CommandHandler(UpdateVaultCommand)
export class UpdateVaultHandler implements ICommandHandler<UpdateVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: UpdateVaultCommand) {
    try {
      const vaultUpdateSchema = createUpdateSchema(vaults);

      const parsedData = vaultUpdateSchema.parse({
        name: command.name,
        localPath: command.localPath,
        remote: command.remote,
        branch: command.branch,
        autoSync: command.autoSync,
        syncInterval: command.syncInterval,
        conflictStrategy: command.conflictStrategy,
      });

      const updatedVault = await this.repository.updateById(
        command.id,
        parsedData,
      );

      if (!updatedVault) throw new VaultNotFoundError(command.id);

      return updatedVault;
    } catch (error) {
      if (error instanceof LibsqlError) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new VaultAlreadyExistsError(command.name ?? '');
        }
      }

      throw error;
    }
  }
}
