import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { CreateVaultHandler } from './commands/create-vault.command';
import { VaultRepository } from './vault.repository';
import { UpdateVaultHandler } from './commands/update-vault.command';
import { DeleteVaultHandler } from './commands/delete-vault.command';
import { GetVaultHandler } from './queries/get-vault.query';
import { ListVaultsHandler } from './queries/list-vaults.query';
import { VaultController } from './vault.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    VaultRepository,
    CreateVaultHandler,
    UpdateVaultHandler,
    DeleteVaultHandler,
    GetVaultHandler,
    ListVaultsHandler,
  ],
  controllers: [VaultController],
})
export class VaultModule {}
