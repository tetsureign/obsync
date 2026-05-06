import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { SyncRepository } from './sync.repository';
import { GitModule } from '@/git/git.module';
import { GitPullHandler } from './commands/git-pull.command';
import { GitStageHandler } from './commands/git-stage.command';
import { GitCommitHandler } from './commands/git-commit.command';
import { GitPushHandler } from './commands/git-push.command';

@Module({
  imports: [DatabaseModule, GitModule],
  providers: [
    SyncRepository,
    GitPullHandler,
    GitStageHandler,
    GitCommitHandler,
    GitPushHandler,
  ],
})
export class SyncModule {}
