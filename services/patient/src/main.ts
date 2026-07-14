import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getAuthConfig } from './config/auth.config';
import { getCorsConfig } from './config/cors.config';

async function bootstrap() {
  // Fail fast, before the app ever listens, if JWT_ACCESS_SECRET is unset or
  // still the dev placeholder outside test/development (see auth.config.ts).
  getAuthConfig();

  const app = await NestFactory.create(AppModule);
  // `apps/web` calls this service cross-origin in every real deployment
  // (BAC-14, added proactively -- see `src/config/cors.config.ts`; BAC-17
  // will be the first ticket to actually exercise this from the browser).
  app.enableCors(getCorsConfig());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
