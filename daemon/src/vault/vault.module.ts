import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { CreateVaultHandler } from './commands/create-vault.command';
import { VaultRepository } from './vault.repository';
import { UpdateVaultHandler } from './commands/update-vault.command';
import { DeleteVaultHandler } from './commands/delete-vault.command';
import { GetVaultHandler } from './queries/get-vault.query';
import { ListVaultsHandler } from './queries/list-vaults.query';
import { VaultController } from './vault.controller';
import { GetVaultByPathHandler } from './queries/get-vault-by-path.query';
import { SyncModule } from '@/sync/sync.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => SyncModule)],
  providers: [
    VaultRepository,
    CreateVaultHandler,
    UpdateVaultHandler,
    DeleteVaultHandler,
    GetVaultHandler,
    ListVaultsHandler,
    GetVaultByPathHandler,
  ],
  exports: [VaultRepository],
  controllers: [VaultController],
})
export class VaultModule {}
