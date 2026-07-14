import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { VitalSigns } from '@hep/shared-types';

// Plausible clinical bounds (BAC-15, AC3): deliberately generous (adult AND
// pediatric-adjacent) ranges wide enough to admit any real vital sign a
// provider would chart, while still rejecting obvious data-entry errors
// (e.g. a heart rate of 900, a temperature of 0). Units match
// `@hep/shared-types`' `VitalSigns` doc comment exactly.
const HEART_RATE_MIN_BPM = 30;
const HEART_RATE_MAX_BPM = 250;
const BLOOD_PRESSURE_SYSTOLIC_MIN_MMHG = 60;
const BLOOD_PRESSURE_SYSTOLIC_MAX_MMHG = 250;
const BLOOD_PRESSURE_DIASTOLIC_MIN_MMHG = 30;
const BLOOD_PRESSURE_DIASTOLIC_MAX_MMHG = 150;
const TEMPERATURE_MIN_CELSIUS = 30;
const TEMPERATURE_MAX_CELSIUS = 45;
const RESPIRATORY_RATE_MIN_BPM = 5;
const RESPIRATORY_RATE_MAX_BPM = 60;
const SPO2_MIN_PERCENT = 50;
const SPO2_MAX_PERCENT = 100;

/**
 * Validates an encounter's vitals (BAC-15, AC1/AC3): every field is
 * optional (a provider may not capture every vital at every visit), but
 * WHEN PRESENT must fall within a plausible clinical range -- enforced by
 * `class-validator` decorators, not ad hoc checks, so `ValidationPipe`
 * rejects an out-of-range payload with 400 automatically, the same
 * mechanism `services/patient`'s `CreatePatientDto` and this service's own
 * `CreatePatientDto` (BAC-10) already rely on.
 */
export class VitalSignsDto implements VitalSigns {
  @IsOptional()
  @IsNumber()
  @Min(HEART_RATE_MIN_BPM)
  @Max(HEART_RATE_MAX_BPM)
  heartRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(BLOOD_PRESSURE_SYSTOLIC_MIN_MMHG)
  @Max(BLOOD_PRESSURE_SYSTOLIC_MAX_MMHG)
  bloodPressureSystolic?: number;

  @IsOptional()
  @IsNumber()
  @Min(BLOOD_PRESSURE_DIASTOLIC_MIN_MMHG)
  @Max(BLOOD_PRESSURE_DIASTOLIC_MAX_MMHG)
  bloodPressureDiastolic?: number;

  @IsOptional()
  @IsNumber()
  @Min(TEMPERATURE_MIN_CELSIUS)
  @Max(TEMPERATURE_MAX_CELSIUS)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(RESPIRATORY_RATE_MIN_BPM)
  @Max(RESPIRATORY_RATE_MAX_BPM)
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(SPO2_MIN_PERCENT)
  @Max(SPO2_MAX_PERCENT)
  spO2?: number;
}
