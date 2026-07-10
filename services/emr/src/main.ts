import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { FhirExceptionFilter } from './fhir/fhir-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
