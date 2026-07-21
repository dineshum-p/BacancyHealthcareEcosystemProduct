"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import type {
  AllergySeverity,
  CreateEncounterRequest,
} from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLERGY_SEVERITY_OPTIONS: readonly AllergySeverity[] = [
  "mild",
  "moderate",
  "severe",
];

/**
 * Plausible clinical bounds mirroring `services/emr`'s `VitalSignsDto`
 * exactly (BAC-15, AC3; BAC-20's own AC) -- see that DTO for the "why" of
 * each bound. Duplicated here (not imported) because these are validation
 * RULES belonging to a `class-validator` DTO, not a shared TYPE; only the
 * shapes (`CreateEncounterRequest`/`VitalSigns`/etc., from
 * `@hep/shared-types`) are shared across the boundary.
 */
const VITALS_RANGES = {
  heartRate: { min: 30, max: 250, label: "Heart rate" },
  bloodPressureSystolic: { min: 60, max: 250, label: "Systolic BP" },
  bloodPressureDiastolic: { min: 30, max: 150, label: "Diastolic BP" },
  temperature: { min: 30, max: 45, label: "Temperature" },
  respiratoryRate: { min: 5, max: 60, label: "Respiratory rate" },
  spO2: { min: 50, max: 100, label: "SpO2" },
} as const;

type VitalKey = keyof typeof VITALS_RANGES;

/** `""` (not provided) or a value within the vital's plausible clinical range -- a UX convenience only, the server re-validates independently. */
function vitalField(key: VitalKey) {
  const { min, max, label } = VITALS_RANGES[key];
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (!Number.isNaN(Number(value)) &&
          Number(value) >= min &&
          Number(value) <= max),
      { message: `${label} must be between ${min} and ${max}` },
    );
}

const soapNoteFormSchema = z.object({
  subjective: z.string().trim().min(1, "Subjective is required"),
  objective: z.string().trim().min(1, "Objective is required"),
  assessment: z.string().trim().min(1, "Assessment is required"),
  plan: z.string().trim().min(1, "Plan is required"),
  heartRate: vitalField("heartRate"),
  bloodPressureSystolic: vitalField("bloodPressureSystolic"),
  bloodPressureDiastolic: vitalField("bloodPressureDiastolic"),
  temperature: vitalField("temperature"),
  respiratoryRate: vitalField("respiratoryRate"),
  spO2: vitalField("spO2"),
  allergies: z.array(
    z.object({
      substance: z.string().trim().min(1, "Substance is required").max(200),
      reaction: z.string().trim().max(500),
      severity: z.union([z.enum(ALLERGY_SEVERITY_OPTIONS), z.literal("")]),
    }),
  ),
});

type SoapNoteFormValues = z.infer<typeof soapNoteFormSchema>;

function toCreateEncounterRequest(
  values: SoapNoteFormValues,
): CreateEncounterRequest {
  const vitals: CreateEncounterRequest["vitals"] = {};
  for (const key of Object.keys(VITALS_RANGES) as VitalKey[]) {
    const raw = values[key];
    if (raw !== "") {
      vitals[key] = Number(raw);
    }
  }

  const allergies = values.allergies
    .filter((allergy) => allergy.substance !== "")
    .map((allergy) => ({
      substance: allergy.substance,
      ...(allergy.reaction ? { reaction: allergy.reaction } : {}),
      ...(allergy.severity ? { severity: allergy.severity } : {}),
    }));

  return {
    soapNote: {
      subjective: values.subjective,
      objective: values.objective,
      assessment: values.assessment,
      plan: values.plan,
    },
    ...(Object.keys(vitals).length > 0 ? { vitals } : {}),
    ...(allergies.length > 0 ? { allergies } : {}),
  };
}

export interface SoapNoteFormProps {
  onSubmit: (input: CreateEncounterRequest) => void;
  isSubmitting: boolean;
}

/** BAC-20, AC1/AC2: Subjective/Objective/Assessment/Plan, vitals, and an allergy list, in one signable note. */
export function SoapNoteForm({ onSubmit, isSubmitting }: SoapNoteFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SoapNoteFormValues>({
    resolver: zodResolver(soapNoteFormSchema),
    defaultValues: {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      heartRate: "",
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      temperature: "",
      respiratoryRate: "",
      spO2: "",
      allergies: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "allergies",
  });

  function submit(values: SoapNoteFormValues) {
    onSubmit(toCreateEncounterRequest(values));
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          SOAP note
        </legend>
        <TextField
          id="subjective"
          label="Subjective"
          error={errors.subjective?.message}
          textareaProps={register("subjective")}
        />
        <TextField
          id="objective"
          label="Objective"
          error={errors.objective?.message}
          textareaProps={register("objective")}
        />
        <TextField
          id="assessment"
          label="Assessment"
          error={errors.assessment?.message}
          textareaProps={register("assessment")}
        />
        <TextField
          id="plan"
          label="Plan"
          error={errors.plan?.message}
          textareaProps={register("plan")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          Vitals
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="heartRate"
            label="Heart rate (bpm)"
            error={errors.heartRate?.message}
            inputProps={register("heartRate")}
          />
          <NumberField
            id="bloodPressureSystolic"
            label="Systolic BP (mmHg)"
            error={errors.bloodPressureSystolic?.message}
            inputProps={register("bloodPressureSystolic")}
          />
          <NumberField
            id="bloodPressureDiastolic"
            label="Diastolic BP (mmHg)"
            error={errors.bloodPressureDiastolic?.message}
            inputProps={register("bloodPressureDiastolic")}
          />
          <NumberField
            id="temperature"
            label="Temperature (°C)"
            error={errors.temperature?.message}
            inputProps={register("temperature")}
          />
          <NumberField
            id="respiratoryRate"
            label="Respiratory rate (breaths/min)"
            error={errors.respiratoryRate?.message}
            inputProps={register("respiratoryRate")}
          />
          <NumberField
            id="spO2"
            label="SpO2 (%)"
            error={errors.spO2?.message}
            inputProps={register("spO2")}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-heading text-base font-semibold text-foreground">
          Allergies
        </legend>
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No allergies added.
          </p>
        )}
        {fields.map((field, index) => (
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
                onClick={() => remove(index)}
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
            append({ substance: "", reaction: "", severity: "" })
          }
        >
          Add allergy
        </Button>
      </fieldset>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full sm:w-auto"
      >
        {isSubmitting ? "Signing…" : "Sign & save note"}
      </Button>
    </form>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  error?: string;
  textareaProps: ReturnType<
    ReturnType<typeof useForm<SoapNoteFormValues>>["register"]
  >;
}

function TextField({ id, label, error, textareaProps }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={Boolean(error)}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...textareaProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  error?: string;
  inputProps: ReturnType<
    ReturnType<typeof useForm<SoapNoteFormValues>>["register"]
  >;
}

function NumberField({ id, label, error, inputProps }: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        aria-invalid={Boolean(error)}
        className="h-10"
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
