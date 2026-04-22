import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ListVaultsQuery } from './queries/list-vaults.query';
import { ZodSerializerDto } from 'nestjs-zod';
import { GetAllVaultsDto } from './dto/get-all-vaults.dto';
import { CreateVaultCommand } from './commands/create-vault.command';
import { CreateVaultDto } from './dto/create-vault.dto';
import { VaultResponseDto } from './dto/vault-response.dto';
import { GetVaultQuery } from './queries/get-vault.query';
import { GetVaultParamsDto } from './dto/get-vault-params.dto';
import { UpdateVaultCommand } from './commands/update-vault.command';
import { UpdateVaultDto } from './dto/update-vault.dto';
import { DeleteVaultCommand } from './commands/delete-vault.command';

@Controller('vaults')
export class VaultController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get()
  @ZodSerializerDto(GetAllVaultsDto)
  async getAllVaults(): Promise<GetAllVaultsDto> {
    return this.queryBus.execute(new ListVaultsQuery());
  }

  @Post()
  @ZodSerializerDto(VaultResponseDto)
  async createVault(
    @Body() createVaultDto: CreateVaultDto,
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
    @Body() updateVaultDto: UpdateVaultDto,
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
