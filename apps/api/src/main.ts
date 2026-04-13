import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  if (config.get<boolean>('database.runMigrations')) {
    const dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }

  const port = config.get<number>('app.port', 3000);
  const globalPrefix = config.get<string>('app.globalPrefix', 'api');
  const corsOrigins = config.get<string[]>('app.corsOrigins', []);

  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  } else {
    app.enableCors({ origin: true });
  }

  await app.listen(port);
}

bootstrap();
