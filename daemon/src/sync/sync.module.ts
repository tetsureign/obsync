import { DatabaseModule } from '@/database/database.module';
import { forwardRef, Module } from '@nestjs/common';
import { SyncRepository } from './sync.repository';
import { GitModule } from '@/git/git.module';
import { PullVaultHandler } from './commands/pull-vault.command';
import { StageVaultHandler } from './commands/stage-vault.command';
import { CommitVaultHandler } from './commands/commit-vault.command';
import { PushVaultHandler } from './commands/push-vault.command';
import { SyncVaultHandler } from './commands/sync-vault.command';
import { VaultModule } from '@/vault/vault.module';
import { SyncQueueModule } from '@/sync-queue/sync-queue.module';

@Module({
  imports: [
    DatabaseModule,
    GitModule,
    SyncQueueModule,
    forwardRef(() => VaultModule),
  ],
  providers: [
    SyncRepository,
    PullVaultHandler,
    StageVaultHandler,
    CommitVaultHandler,
    PushVaultHandler,
    SyncVaultHandler,
  ],
  exports: [SyncRepository],
})
export class SyncModule {}
