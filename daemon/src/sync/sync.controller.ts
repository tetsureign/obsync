import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

@Controller('vault')
export class SyncController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Post(':id/sync')
  @ZodSerializerDto(SyncResponseDto)
  async syncVault(
    @Param() param: GetVaultParamsDto,
    @Body() syncVaultDto: SyncVaultCommandDto,
  ): Promise<SyncOperation> {
    return await this.commandBus.execute(
      new SyncVaultCommand(
        param.id,
        syncVaultDto.filePaths,
        syncVaultDto.commitMessage,
      ),
    );
  }

  @Get(':id/status')
  async getSyncStatus(
    @Param() param: GetVaultParamsDto,
    @Body() query: GetSyncStatusQueryDto,
  ): Promise<SyncStatus> {
    return await this.queryBus.execute(
      new GetSyncStatusQuery(param.id, query.lastNCompletedSync),
    );
  }

  @Get(':id/syncs')
  @ZodSerializerDto(GetHistoryQueryResponseDto)
  async getSyncHistory(
    @Param() param: GetVaultParamsDto,
  ): Promise<SyncOperation[]> {
    return await this.queryBus.execute(new GetSyncHistoryQuery(param.id));
  }

  @Get(':id/git-status')
  async getGitStatus(@Param() param: GetVaultParamsDto): Promise<StatusResult> {
    return await this.queryBus.execute(new GetGitStatusQuery(param.id));
  }

  @Get(':id/git-diff')
  async getGitDiff(
    @Param() param: GetVaultParamsDto,
    @Body() query: GetGitDiffQueryDto,
  ): Promise<string> {
    return await this.queryBus.execute(
      new GetGitDiffQuery(param.id, query.options),
    );
  }

  @Post(':id/abort')
  async abortSync(@Param() params: GetVaultParamsDto): Promise<boolean> {
    return await this.commandBus.execute(new AbortSyncCommand(params.id));
  }
}
