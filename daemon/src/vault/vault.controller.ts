import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ListVaultsQuery } from './queries/list-vaults.query';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetAllVaultsResponseDto } from './dto/get-all-vaults-response.dto';
import { CreateVaultCommand } from './commands/create-vault.command';
import { CreateVaultCommandDto } from './dto/create-vault-command.dto';
import { VaultResponseDto } from './dto/vault-response.dto';
import { GetVaultQuery } from './queries/get-vault.query';
import { GetVaultParamsDto } from './dto/get-vault-params.dto';
import { UpdateVaultCommand } from './commands/update-vault.command';
import { UpdateVaultCommandDto } from './dto/update-vault-command.dto';
import { DeleteVaultCommand } from './commands/delete-vault.command';
import { GetVaultByPathQuery } from './queries/get-vault-by-path.query';
import { GetVaultByPathQueryDto } from './dto/get-vault-by-path-query.dto';

@Controller('vaults')
export class VaultController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get()
  @ZodSerializerDto(GetAllVaultsResponseDto)
  async getAllVaults(): Promise<GetAllVaultsResponseDto> {
    return this.queryBus.execute(new ListVaultsQuery());
  }

  @Post()
  @ZodSerializerDto(VaultResponseDto)
  async createVault(
    @Body() createVaultDto: CreateVaultCommandDto,
  ): Promise<VaultResponseDto> {
    return this.commandBus.execute(
      new CreateVaultCommand(
        createVaultDto.name,
        createVaultDto.localPath,
        createVaultDto.remote,
        createVaultDto.branch,
        createVaultDto.autoSync,
        createVaultDto.syncInterval,
        createVaultDto.conflictStrategy,
      ),
    );
  }

  @Get('by-path')
  @ZodSerializerDto(VaultResponseDto)
  async getVaultByPath(
    @Query() query: GetVaultByPathQueryDto,
  ): Promise<VaultResponseDto> {
    return this.queryBus.execute(new GetVaultByPathQuery(query.localPath));
  }

  @Get(':id')
  @ZodSerializerDto(VaultResponseDto)
  async getVaultById(
    @Param() params: GetVaultParamsDto,
  ): Promise<VaultResponseDto> {
    return this.queryBus.execute(new GetVaultQuery(params.id));
  }

  @Patch(':id')
  @ZodSerializerDto(VaultResponseDto)
  async updateVault(
    @Param() params: GetVaultParamsDto,
    @Body() updateVaultDto: UpdateVaultCommandDto,
  ): Promise<VaultResponseDto> {
    return this.commandBus.execute(
      new UpdateVaultCommand(
        params.id,
        updateVaultDto.name,
        updateVaultDto.localPath,
        updateVaultDto.remote,
        updateVaultDto.branch,
        updateVaultDto.autoSync,
        updateVaultDto.syncInterval,
        updateVaultDto.conflictStrategy,
      ),
    );
  }

  @Delete(':id')
  async deleteVault(@Param() params: GetVaultParamsDto): Promise<boolean> {
    return this.commandBus.execute(new DeleteVaultCommand(params.id));
  }
}
