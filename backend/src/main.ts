import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.getOrThrow<string>('API_PREFIX');

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP Pirotécnico API')
    .setDescription('API modular para gestão de operações pirotécnicas.')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    `${prefix}/docs`,
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}

await bootstrap();
