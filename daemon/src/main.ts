import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Database } from './database/database';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const db = app.get(Database);

  const port = configService.get<number>('PORT') || 3000;
  const nodeEnv = configService.get<string>('NODE_ENV');

  // Dev-only Setups
  if (nodeEnv !== 'production') {
    // Swagger UI Setup
    const openApiDoc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('obsync daemon')
        .setDescription('Go nuts')
        .setVersion('1.0')
        .build(),
    );

    SwaggerModule.setup('api', app, cleanupOpenApiDoc(openApiDoc));
  }

  await db.configure();

  logger.log('Starting database migrations...');
  try {
    migrate(db.db, { migrationsFolder: 'drizzle' });
  } catch (error) {
    logger.error('Error occurred while running database migrations:', error);
  }
  logger.log('Database migrations completed.');

  app.enableCors({
    origin: `127.0.0.1`,
  });

  await app.listen(port, '127.0.0.1');
}

void bootstrap();
