import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { SyncRepository } from './sync.repository';
import { GitModule } from '@/git/git.module';

@Module({
  imports: [DatabaseModule, GitModule],
  providers: [SyncRepository],
})
export class SyncModule {}
