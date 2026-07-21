/**
 * Renders a `date`-typed column value as a bare `YYYY-MM-DD` string,
 * regardless of the driver's `Date`/string representation.
 *
 * `pg`'s runtime type parser for a `date` column (`postgres-date`'s
 * `getDate`, registered for OID 1082) builds the `Date` with the
 * *local-timezone* constructor -- `new Date(year, month, day)` -- to
 * represent local midnight on that calendar date, NOT UTC midnight. Reading
 * it back with `.toISOString()` (UTC-based) therefore shifts the result to
 * the previous calendar day in any timezone ahead of UTC, and to the next
 * day in any timezone behind it -- an off-by-one bug. Reading the same
 * *local* components back out (`getFullYear`/`getMonth`/`getDate`) undoes
 * exactly what the parser did, so the calendar date round-trips correctly
 * regardless of the host's timezone.
 *
 * Extracted from `PatientsService` (BAC-14/BAC-17) so `PatientsService` and
 * `PatientSelfRegistrationsService` (BAC-36) share one implementation
 * instead of duplicating this timezone-sensitive logic.
 */
export function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
