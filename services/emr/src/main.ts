import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { FhirExceptionFilter } from './fhir/fhir-exception.filter';
import { getCorsConfig } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // `apps/web` calls this service cross-origin in every real deployment --
  // see `src/config/cors.config.ts`.
  app.enableCors(getCorsConfig());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // BAC-10, AC3: every error response from this service is a FHIR
  // OperationOutcome resource, not Nest's generic error shape.
  app.useGlobalFilters(new FhirExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
