import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QueryBus } from '@nestjs/cqrs/dist/query-bus';
import { SyncVaultCommand } from './commands/sync-vault.command';
import { SyncOperation, SyncStatus } from './sync.types';
import { SyncVaultCommandDto } from './dto/sync-vault-command.dto';
import { ZodSerializerDto } from 'nestjs-zod';
import { SyncResponseDto } from './dto/sync-response.dto';
import { GetVaultParamsDto } from '@/vault/dto/get-vault-params.dto';
import { GetSyncStatusQuery } from './queries/get-sync-status.query';
import { GetSyncStatusQueryDto } from './dto/get-sync-status-query.dto';
import { GetSyncHistoryQuery } from './queries/get-sync-history.query';
import { GetHistoryQueryResponseDto } from './dto/get-history-query-response.dto';
import { AbortSyncCommand } from './commands/abort-sync.command';
import { GetGitStatusQuery } from './queries/get-git-status.query';
import { StatusResult } from 'simple-git';
import { GetGitDiffQuery } from './queries/get-git-diff.query';
import { GetGitDiffQueryDto } from './dto/get-git-diff-query.dto';
import { PullVaultCommand } from './commands/pull-vault.command';
import { StageVaultCommand } from './commands/stage-vault.command';
import { StageVaultCommandDto } from './dto/stage-vault-command.dto';
import { CommitVaultCommand } from './commands/commit-vault.command';
import { CommitVaultCommandDto } from './dto/commit-vault-command.dto';
import { PushVaultCommand } from './commands/push-vault.command';

@Controller('vaults')
export class SyncController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Post(':name/sync')
  @ZodSerializerDto(SyncResponseDto)
  async syncVault(
    @Param() param: GetVaultParamsDto,
    @Body() syncVaultDto: SyncVaultCommandDto,
  ): Promise<SyncOperation> {
    return await this.commandBus.execute(
      new SyncVaultCommand(
        param.name,
        syncVaultDto.filePaths,
        syncVaultDto.commitMessage,
      ),
    );
  }

  @Post(':name/abort')
  async abortSync(@Param() params: GetVaultParamsDto): Promise<boolean> {
    return await this.commandBus.execute(new AbortSyncCommand(params.name));
  }

  @Get(':name/status')
  async getSyncStatus(
    @Param() param: GetVaultParamsDto,
    @Query() query: GetSyncStatusQueryDto,
  ): Promise<SyncStatus> {
    return await this.queryBus.execute(
      new GetSyncStatusQuery(param.name, query.recentSyncLimit),
    );
  }

  @Get(':name/syncs')
  @ZodSerializerDto(GetHistoryQueryResponseDto)
  async getSyncHistory(
    @Param() param: GetVaultParamsDto,
  ): Promise<SyncOperation[]> {
    return await this.queryBus.execute(new GetSyncHistoryQuery(param.name));
  }

  @Get(':name/git-status')
  async getGitStatus(@Param() param: GetVaultParamsDto): Promise<StatusResult> {
    return await this.queryBus.execute(new GetGitStatusQuery(param.name));
  }

  @Get(':name/git-diff')
  async getGitDiff(
    @Param() param: GetVaultParamsDto,
    @Query() query: GetGitDiffQueryDto,
  ): Promise<string> {
    return await this.queryBus.execute(
      new GetGitDiffQuery(param.name, query.options),
    );
  }

  @Post(':name/git-pull')
  async pullVault(@Param() params: GetVaultParamsDto): Promise<boolean> {
    return await this.commandBus.execute(new PullVaultCommand(params.name));
  }

  @Post(':name/git-stage')
  async stageVault(
    @Param() params: GetVaultParamsDto,
    @Body() stageVaultDto: StageVaultCommandDto,
  ): Promise<boolean> {
    return await this.commandBus.execute(
      new StageVaultCommand(params.name, stageVaultDto.filePaths),
    );
  }

  @Post(':name/git-commit')
  async commitVault(
    @Param() params: GetVaultParamsDto,
    @Body() commitVaultDto: CommitVaultCommandDto,
  ): Promise<boolean> {
    return await this.commandBus.execute(
      new CommitVaultCommand(params.name, commitVaultDto.commitMessage),
    );
  }

  @Post(':name/git-push')
  async pushVault(@Param() params: GetVaultParamsDto): Promise<boolean> {
    return await this.commandBus.execute(new PushVaultCommand(params.name));
  }
}
