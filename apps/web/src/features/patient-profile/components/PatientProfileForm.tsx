"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import type {
  AllergySeverity,
  PatientProfileResponse,
  UpsertPatientProfileRequest,
} from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLERGY_SEVERITY_OPTIONS: readonly AllergySeverity[] = [
  "mild",
  "moderate",
  "severe",
];

const profileFormSchema = z.object({
  allergies: z.array(
    z.object({
      substance: z.string().trim().min(1, "Substance is required").max(200),
      reaction: z.string().trim().max(500),
      severity: z.union([z.enum(ALLERGY_SEVERITY_OPTIONS), z.literal("")]),
    }),
  ),
  chronicConditions: z.array(
    z.object({
      name: z.string().trim().min(1, "Condition name is required").max(200),
      diagnosedDate: z.string().trim(),
      notes: z.string().trim().max(500),
    }),
  ),
  medications: z.array(
    z.object({
      name: z.string().trim().min(1, "Medication name is required").max(200),
      dosage: z.string().trim().max(100),
      frequency: z.string().trim().max(100),
      notes: z.string().trim().max(500),
    }),
  ),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** `""` is "not provided" for an optional field -- omitted from the request rather than sent as an empty string. */
function optional(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function toUpsertRequest(
  values: ProfileFormValues,
): UpsertPatientProfileRequest {
  return {
    allergies: values.allergies.map((allergy) => ({
      substance: allergy.substance,
      ...(optional(allergy.reaction) ? { reaction: allergy.reaction } : {}),
      ...(allergy.severity ? { severity: allergy.severity } : {}),
    })),
    chronicConditions: values.chronicConditions.map((condition) => ({
      name: condition.name,
      ...(optional(condition.diagnosedDate)
        ? { diagnosedDate: condition.diagnosedDate }
        : {}),
      ...(optional(condition.notes) ? { notes: condition.notes } : {}),
    })),
    medications: values.medications.map((medication) => ({
      name: medication.name,
      ...(optional(medication.dosage) ? { dosage: medication.dosage } : {}),
      ...(optional(medication.frequency)
        ? { frequency: medication.frequency }
        : {}),
      ...(optional(medication.notes) ? { notes: medication.notes } : {}),
    })),
  };
}

function toFormValues(profile: PatientProfileResponse): ProfileFormValues {
  return {
    allergies: profile.allergies.map((allergy) => ({
      substance: allergy.substance,
      reaction: allergy.reaction ?? "",
      severity: allergy.severity ?? "",
    })),
    chronicConditions: profile.chronicConditions.map((condition) => ({
      name: condition.name,
      diagnosedDate: condition.diagnosedDate ?? "",
      notes: condition.notes ?? "",
    })),
    medications: profile.medications.map((medication) => ({
      name: medication.name,
      dosage: medication.dosage ?? "",
      frequency: medication.frequency ?? "",
      notes: medication.notes ?? "",
    })),
  };
}

export interface PatientProfileFormProps {
  profile: PatientProfileResponse;
  onSubmit: (input: UpsertPatientProfileRequest) => void;
  isSubmitting: boolean;
}

/**
 * BAC-46: the editable baseline profile form -- allergies, chronic
 * conditions, and long-term medications (all editable field arrays), plus
 * read-only demographics (`services/emr` never accepts these on `PUT`, see
 * `PatientProfileDemographics`'s doc comment). Pre-filled from `profile`
 * whether or not `hasProfile` is `true`: for a first-login caller (AC1) every
 * array is simply empty, which this form already renders as a friendly
 * per-section "nothing added yet" message rather than an empty/broken-looking
 * grid, with "Add" affordances to start filling it in immediately -- no
 * separate "create my profile" step. Mirrors `SoapNoteForm`'s exact RHF+zod
 * field-array shape.
 */
export function PatientProfileForm({
  profile,
  onSubmit,
  isSubmitting,
}: PatientProfileFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(profile),
  });

  const allergyArray = useFieldArray({ control, name: "allergies" });
  const conditionArray = useFieldArray({ control, name: "chronicConditions" });
  const medicationArray = useFieldArray({ control, name: "medications" });

  function submit(values: ProfileFormValues) {
    onSubmit(toUpsertRequest(values));
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="font-heading text-base font-semibold text-foreground">
          Demographics
        </legend>
        <p className="text-xs text-muted-foreground">
          Sourced from your record -- contact your clinic to correct these.
        </p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <DemographicField
            label="First name"
            value={profile.demographics.firstName}
          />
          <DemographicField
            label="Last name"
            value={profile.demographics.lastName}
          />
          <DemographicField
            label="Date of birth"
            value={profile.demographics.dateOfBirth}
          />
        </dl>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          Allergies
        </legend>
        {allergyArray.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No allergies added yet.
          </p>
        )}
        {allergyArray.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-4 rounded-lg border border-border/70 p-4 sm:grid-cols-[2fr_2fr_1fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`allergies.${index}.substance`}>
                Substance
              </Label>
              <Input
                id={`allergies.${index}.substance`}
                className="h-10"
                aria-invalid={Boolean(
                  errors.allergies?.[index]?.substance?.message,
                )}
                {...register(`allergies.${index}.substance`)}
              />
              {errors.allergies?.[index]?.substance?.message && (
                <p className="text-xs text-destructive">
                  {errors.allergies[index]?.substance?.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`allergies.${index}.reaction`}>Reaction</Label>
              <Input
                id={`allergies.${index}.reaction`}
                className="h-10"
                {...register(`allergies.${index}.reaction`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`allergies.${index}.severity`}>Severity</Label>
              <select
                id={`allergies.${index}.severity`}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register(`allergies.${index}.severity`)}
              >
                <option value="">Unspecified</option>
                {ALLERGY_SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => allergyArray.remove(index)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            allergyArray.append({ substance: "", reaction: "", severity: "" })
          }
        >
          Add allergy
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          Chronic conditions
        </legend>
        {conditionArray.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No chronic conditions added yet.
          </p>
        )}
        {conditionArray.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-4 rounded-lg border border-border/70 p-4 sm:grid-cols-[2fr_1fr_2fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`chronicConditions.${index}.name`}>
                Condition
              </Label>
              <Input
                id={`chronicConditions.${index}.name`}
                className="h-10"
                aria-invalid={Boolean(
                  errors.chronicConditions?.[index]?.name?.message,
                )}
                {...register(`chronicConditions.${index}.name`)}
              />
              {errors.chronicConditions?.[index]?.name?.message && (
                <p className="text-xs text-destructive">
                  {errors.chronicConditions[index]?.name?.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`chronicConditions.${index}.diagnosedDate`}>
                Diagnosed
              </Label>
              <Input
                id={`chronicConditions.${index}.diagnosedDate`}
                type="date"
                className="h-10"
                {...register(`chronicConditions.${index}.diagnosedDate`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`chronicConditions.${index}.notes`}>
                Notes
              </Label>
              <Input
                id={`chronicConditions.${index}.notes`}
                className="h-10"
                {...register(`chronicConditions.${index}.notes`)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => conditionArray.remove(index)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            conditionArray.append({ name: "", diagnosedDate: "", notes: "" })
          }
        >
          Add condition
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          Long-term medications
        </legend>
        {medicationArray.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No medications added yet.
          </p>
        )}
        {medicationArray.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-4 rounded-lg border border-border/70 p-4 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`medications.${index}.name`}>Medication</Label>
              <Input
                id={`medications.${index}.name`}
                className="h-10"
                aria-invalid={Boolean(
                  errors.medications?.[index]?.name?.message,
                )}
                {...register(`medications.${index}.name`)}
              />
              {errors.medications?.[index]?.name?.message && (
                <p className="text-xs text-destructive">
                  {errors.medications[index]?.name?.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`medications.${index}.dosage`}>Dosage</Label>
              <Input
                id={`medications.${index}.dosage`}
                className="h-10"
                {...register(`medications.${index}.dosage`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`medications.${index}.frequency`}>
                Frequency
              </Label>
              <Input
                id={`medications.${index}.frequency`}
                className="h-10"
                {...register(`medications.${index}.frequency`)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`medications.${index}.notes`}>Notes</Label>
              <Input
                id={`medications.${index}.notes`}
                className="h-10"
                {...register(`medications.${index}.notes`)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => medicationArray.remove(index)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            medicationArray.append({
              name: "",
              dosage: "",
              frequency: "",
              notes: "",
            })
          }
        >
          Add medication
        </Button>
      </fieldset>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full sm:w-auto"
      >
        {isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function DemographicField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">Not on file</span>}
      </dd>
    </div>
  );
}
