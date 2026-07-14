import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PatientSearchQuery } from '@hep/shared-types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the query string of `GET /patients` (BAC-14, AC3):
 * `?name=&mrn=&dateOfBirth=YYYY-MM-DD&page=&limit=`, all optional and
 * combinable. Modelled after `services/tenant`'s BAC-8
 * `AuditLogQueryDto` pagination shape.
 */
export class PatientSearchQueryDto implements PatientSearchQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mrn?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN, {
    message: 'dateOfBirth must be in YYYY-MM-DD format (e.g. "1990-05-12")',
  })
  dateOfBirth?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;
}
