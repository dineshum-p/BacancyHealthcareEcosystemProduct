import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * `GET /audit-logs` query params (BAC-8, AC7): pagination via `page`/`limit`
 * plus filters by `actor` (userId) and `resource` (type and/or id) --
 * modelled here as separate `resourceType`/`resourceId` params for
 * unambiguous filtering, both optional and combinable.
 */
export class AuditLogQueryDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resourceId?: string;
}
