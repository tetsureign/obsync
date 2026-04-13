import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { VaultService } from './vault.service';

@Module({
  imports: [DatabaseModule],
  providers: [VaultService],
})
export class VaultModule {}
