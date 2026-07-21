import { IsIn, IsOptional } from 'class-validator';
import type { VisitIntakeQuery, VisitIntakeStatus } from '@hep/shared-types';

const VISIT_INTAKE_STATUSES: VisitIntakeStatus[] = ['pending', 'linked'];

/**
 * Validates the query string of `GET /visit-intakes` (BAC-45, AC2): the
 * staff-facing triage queue, `?status=pending` by convention, but any other
 * single lifecycle state is also accepted. Omitting `status` lists every
 * intake tenant-wide regardless of status.
 */
export class VisitIntakeQueryDto implements VisitIntakeQuery {
  @IsOptional()
  @IsIn(VISIT_INTAKE_STATUSES)
  status?: VisitIntakeStatus;
}
