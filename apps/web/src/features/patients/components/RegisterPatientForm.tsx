"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PatientGender, RegisterPatientRequest } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GENDER_OPTIONS: readonly PatientGender[] = [
  "male",
  "female",
  "other",
  "unknown",
];

/**
 * Mirrors `services/patient`'s `CreatePatientDto` constraints (BAC-14, AC1)
 * for fast client-side feedback -- the server remains the source of truth
 * and re-validates independently; this is a UX convenience only. Optional
 * fields use `""` as their "not provided" sentinel (native `<select>`/
 * `<input>` values are always strings) rather than `undefined`, so React
 * Hook Form's `defaultValues` stay fully-controlled from the first render;
 * `toRegisterPatientRequest` below strips them back out before submitting.
 */
const registerPatientFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(200),
  lastName: z.string().trim().min(1, "Last name is required").max(200),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
  gender: z.union([z.enum(GENDER_OPTIONS), z.literal("")]),
  phone: z.string().trim().max(50),
  email: z
    .string()
    .trim()
    .max(320)
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
});

type RegisterPatientFormValues = z.infer<typeof registerPatientFormSchema>;

function toRegisterPatientRequest(
  values: RegisterPatientFormValues,
): RegisterPatientRequest {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    dateOfBirth: values.dateOfBirth,
    ...(values.gender ? { gender: values.gender } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.email ? { email: values.email } : {}),
  };
}

export interface RegisterPatientFormProps {
  onSubmit: (input: RegisterPatientRequest) => void;
  isSubmitting: boolean;
}

/** BAC-17, AC1: patient demographics intake form. */
export function RegisterPatientForm({
  onSubmit,
  isSubmitting,
}: RegisterPatientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterPatientFormValues>({
    resolver: zodResolver(registerPatientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      phone: "",
      email: "",
    },
  });

  function submit(values: RegisterPatientFormValues) {
    onSubmit(toRegisterPatientRequest(values));
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="firstName"
          label="First name"
          error={errors.firstName?.message}
          inputProps={register("firstName")}
        />
        <Field
          id="lastName"
          label="Last name"
          error={errors.lastName?.message}
          inputProps={register("lastName")}
        />
      </div>

      <Field
        id="dateOfBirth"
        label="Date of birth"
        type="date"
        error={errors.dateOfBirth?.message}
        inputProps={register("dateOfBirth")}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gender">Gender</Label>
        <select
          id="gender"
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("gender")}
        >
          <option value="">Prefer not to specify</option>
          {GENDER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option[0].toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="phone"
          label="Phone"
          type="tel"
          error={errors.phone?.message}
          inputProps={register("phone")}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          error={errors.email?.message}
          inputProps={register("email")}
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full sm:w-auto"
      >
        {isSubmitting ? "Registering…" : "Register patient"}
      </Button>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  error?: string;
  inputProps: ReturnType<
    ReturnType<typeof useForm<RegisterPatientFormValues>>["register"]
  >;
}

function Field({ id, label, type = "text", error, inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        aria-invalid={Boolean(error)}
        className="h-10"
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
