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
import { SyncJobRunner } from './sync-job.runner';
import { AbortSyncHandler } from './commands/abort-sync.command';
import { GetSyncStatusHandler } from './queries/get-sync-status.query';
import { GetGitDiffHandler } from './queries/get-git-diff.query';
import { GetGitStatusHandler } from './queries/get-git-status.query';
import { GetSyncHistoryHandler } from './queries/get-sync-history.query';

@Module({
  imports: [
    DatabaseModule,
    GitModule,
    SyncQueueModule,
    forwardRef(() => VaultModule),
  ],
  providers: [
    SyncRepository,
    AbortSyncHandler,
    CommitVaultHandler,
    PullVaultHandler,
    PushVaultHandler,
    StageVaultHandler,
    SyncVaultHandler,
    SyncJobRunner,
    GetGitDiffHandler,
    GetGitStatusHandler,
    GetSyncHistoryHandler,
    GetSyncStatusHandler,
  ],
  exports: [SyncRepository],
})
export class SyncModule {}
