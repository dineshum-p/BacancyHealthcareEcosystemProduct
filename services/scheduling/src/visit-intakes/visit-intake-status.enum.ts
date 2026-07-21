/**
 * Lifecycle of a BAC-45 visit intake, mirroring `@hep/shared-types`'s
 * `VisitIntakeStatus` union. `PENDING` from creation until staff link a
 * specific provider + BAC-16/21 appointment to it (`LINKED`, via
 * `PATCH /visit-intakes/:id/link`).
 */
export enum VisitIntakeStatus {
  PENDING = 'pending',
  LINKED = 'linked',
}
