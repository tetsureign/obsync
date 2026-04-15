import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { VaultService } from './vault.service';
import { CreateVaultHandler } from './commands/create-vault.command';
import { VaultRepository } from './vault.repository';
import { UpdateVaultHandler } from './commands/update-vault.command';
import { DeleteVaultHandler } from './commands/delete-vault.command';

@Module({
  imports: [DatabaseModule],
  providers: [
    VaultService,
    VaultRepository,
    CreateVaultHandler,
    UpdateVaultHandler,
    DeleteVaultHandler,
  ],
})
export class VaultModule {}
