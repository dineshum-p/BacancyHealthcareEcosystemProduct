"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { OnboardTenantRequest } from "@hep/shared-types";

/**
 * Mirrors `services/tenant`'s `OnboardTenantDto` constraints (BAC-12) for
 * fast client-side feedback -- the server remains the source of truth and
 * re-validates independently; this is a UX convenience only.
 */
const onboardTenantSchema = z.object({
  name: z.string().trim().min(1, "Clinic name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(56)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "slug must be a lowercase, kebab-case identifier",
    ),
  plan: z.string().trim().min(1, "Plan is required").max(50),
  adminEmail: z
    .string()
    .trim()
    .min(1, "Admin email is required")
    .email("Enter a valid email address")
    .max(320),
});

export interface OnboardTenantFormProps {
  onSubmit: (input: OnboardTenantRequest) => void;
  isSubmitting: boolean;
}

/** BAC-12, AC1: the onboarding form -- clinic name/slug/plan and an initial admin email. */
export function OnboardTenantForm({
  onSubmit,
  isSubmitting,
}: OnboardTenantFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardTenantRequest>({
    resolver: zodResolver(onboardTenantSchema),
    defaultValues: { name: "", slug: "", plan: "", adminEmail: "" },
  });

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <Field
        id="name"
        label="Clinic name"
        error={errors.name?.message}
        inputProps={register("name")}
      />
      <Field
        id="slug"
        label="Slug"
        error={errors.slug?.message}
        inputProps={register("slug")}
      />
      <Field
        id="plan"
        label="Plan"
        error={errors.plan?.message}
        inputProps={register("plan")}
      />
      <Field
        id="adminEmail"
        label="Admin email"
        type="email"
        error={errors.adminEmail?.message}
        inputProps={register("adminEmail")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Onboarding…" : "Onboard tenant"}
      </button>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  error?: string;
  inputProps: ReturnType<
    ReturnType<typeof useForm<OnboardTenantRequest>>["register"]
  >;
}

function Field({ id, label, type = "text", error, inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        {...inputProps}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
