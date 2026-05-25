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

  @Get(':id/sync/status')
  async getSyncStatus(
    @Param() param: GetVaultParamsDto,
    @Body() query: GetSyncStatusQueryDto,
  ): Promise<SyncStatus> {
    return await this.queryBus.execute(
      new GetSyncStatusQuery(param.id, query.lastNCompletedSync),
    );
  }
}
