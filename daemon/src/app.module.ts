import { ZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { VaultModule } from './vault/vault.module';
import { CqrsModule } from '@nestjs/cqrs';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

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
  ],
})
export class AppModule {}
