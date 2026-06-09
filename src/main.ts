import { webcrypto } from 'node:crypto';
// Node 22+ đã có globalThis.crypto (read-only) — chỉ polyfill khi thiếu (Node cũ)
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express'; 
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path'; 
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  ['uploads', 'uploads/products', 'uploads/avatars'].forEach((dir) => {
    const fullPath = join(__dirname, '..', dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  });

  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Server running at http://localhost:${port}`);
}

bootstrap();