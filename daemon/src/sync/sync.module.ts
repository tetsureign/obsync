import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { SyncRepository } from './sync.repository';
import { GitModule } from '@/git/git.module';
import { PullVaultHandler } from './commands/pull-vault.command';
import { StageVaultHandler } from './commands/stage-vault.command';
import { CommitVaultHandler } from './commands/commit-vault.command';
import { PushVaultHandler } from './commands/push-vault.command';
import { SyncVaultHandler } from './commands/sync-vault.command';

@Module({
  imports: [DatabaseModule, GitModule],
  providers: [
    SyncRepository,
    PullVaultHandler,
    StageVaultHandler,
    CommitVaultHandler,
    PushVaultHandler,
    SyncVaultHandler,
  ],
})
export class SyncModule {}
