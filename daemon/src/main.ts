import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Database } from './database/database';
import { migrate } from 'drizzle-orm/libsql/migrator';

async function bootstrap() {
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
  await migrate(db.db, { migrationsFolder: 'drizzle' });

  app.enableCors({
    origin: `127.0.0.1`,
  });

  await app.listen(port);
}

void bootstrap();
