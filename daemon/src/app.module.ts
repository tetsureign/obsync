import { ZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { VaultModule } from './vault/vault.module';
import { CqrsModule } from '@nestjs/cqrs';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { SyncModule } from './sync/sync.module';
import { GitModule } from './git/git.module';
import { SyncQueueModule } from './sync-queue/sync-queue.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ConflictModule } from './conflict/conflict.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CqrsModule.forRoot(),
    DatabaseModule,
    VaultModule,
    SyncModule,
    GitModule,
    SyncQueueModule,
    ConflictModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    AppService,
  ],
})
export class AppModule {}
