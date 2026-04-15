import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { VaultService } from './vault.service';
import { CreateVaultHandler } from './commands/create-vault.command';
import { VaultRepository } from './vault.repository';
import { UpdateVaultHandler } from './commands/update-vault.command';
import { DeleteVaultHandler } from './commands/delete-vault.command';
import { GetVaultHandler } from './queries/get-vault.query';
import { ListVaultsHandler } from './queries/list-vaults.query';

@Module({
  imports: [DatabaseModule],
  providers: [
    VaultService,
    VaultRepository,
    CreateVaultHandler,
    UpdateVaultHandler,
    DeleteVaultHandler,
    GetVaultHandler,
    ListVaultsHandler,
  ],
})
export class VaultModule {}
