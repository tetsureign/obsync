import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { VaultService } from './vault.service';
import { CreateVaultHandler } from './commands/create-vault.handler';
import { VaultRepository } from './vault.repository';
import { UpdateVaultHandler } from './commands/update-vault.handler';

@Module({
  imports: [DatabaseModule],
  providers: [
    VaultService,
    VaultRepository,
    CreateVaultHandler,
    UpdateVaultHandler,
  ],
})
export class VaultModule {}
