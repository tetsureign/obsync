import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { VaultModule } from './vault/vault.module';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    CqrsModule.forRoot(),
    VaultModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
