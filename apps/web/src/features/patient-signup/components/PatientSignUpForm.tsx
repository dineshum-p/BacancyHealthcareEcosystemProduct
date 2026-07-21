"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Mirrors `services/auth`'s `PatientSignUpDto` constraints (BAC-42/BAC-43)
 * for fast client-side feedback -- the server remains the source of truth
 * and re-validates independently; this is a UX convenience only. `tenantId`
 * has no server-side DTO counterpart, same as `LoginForm`'s own `tenantId`
 * field -- it maps to the `X-Tenant-Id` header `TenantGuard` requires.
 */
const patientSignUpSchema = z.object({
  tenantId: z.string().trim().min(1, "Workspace is required").max(64),
  firstName: z.string().trim().min(1, "First name is required").max(200),
  lastName: z.string().trim().min(1, "Last name is required").max(200),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(320),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export type PatientSignUpFormValues = z.infer<typeof patientSignUpSchema>;

export interface PatientSignUpFormProps {
  onSubmit: (input: PatientSignUpFormValues) => void;
  isSubmitting: boolean;
  /**
   * BAC-38 pattern (matches `LoginForm.defaultTenantId`): pre-fills the
   * workspace field when the tenant was already resolved from the request's
   * subdomain. Still editable, not a locked/hidden field.
   */
  defaultTenantId?: string;
}

/** BAC-43: the patient sign-up form -- workspace, identity, and credentials. */
export function PatientSignUpForm({
  onSubmit,
  isSubmitting,
  defaultTenantId,
}: PatientSignUpFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientSignUpFormValues>({
    resolver: zodResolver(patientSignUpSchema),
    defaultValues: {
      tenantId: defaultTenantId ?? "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      password: "",
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-5"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <Field
        id="tenantId"
        label="Workspace"
        placeholder="acme-clinic"
        error={errors.tenantId?.message}
        inputProps={register("tenantId")}
      />

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

      <Field
        id="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        inputProps={register("email")}
      />

      <Field
        id="password"
        label="Password"
        type="password"
        error={errors.password?.message}
        inputProps={register("password")}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "Signing up…" : "Sign up"}
      </Button>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  inputProps: ReturnType<
    ReturnType<typeof useForm<PatientSignUpFormValues>>["register"]
  >;
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  error,
  inputProps,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="h-10"
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
