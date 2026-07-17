"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { HepModule, OnboardTenantRequest } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODULE_OPTIONS, PLAN_TIER_OPTIONS } from "../moduleOptions";
import { usePricingQuote } from "../hooks/usePricingQuote";
import { PricingSummary } from "./PricingSummary";

/**
 * Mirrors `services/tenant`'s `OnboardTenantDto` constraints (BAC-12 + module
 * selection) for fast client-side feedback -- the server remains the source
 * of truth and re-validates independently; this is a UX convenience only.
 */
const onboardTenantSchema = z.object({
  name: z.string().trim().min(1, "Clinic name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(56)
    .regex(/^[a-z][a-z0-9-]*$/, "slug must be a lowercase, kebab-case identifier"),
  plan: z.enum(["starter", "growth", "enterprise"]),
  modules: z
    .array(z.enum(["clinic", "pharmacy", "doctor", "insurance", "patient_portal"]))
    .min(1, "Select at least one module"),
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

/** BAC-12 + PRD §6: the onboarding form -- clinic details, module selection, plan tier, and a live pricing summary. */
export function OnboardTenantForm({ onSubmit, isSubmitting }: OnboardTenantFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardTenantRequest>({
    resolver: zodResolver(onboardTenantSchema),
    defaultValues: { name: "", slug: "", plan: "starter", modules: [], adminEmail: "" },
  });

  const selectedModules = watch("modules");
  const selectedPlan = watch("plan");
  const quoteQuery = usePricingQuote(selectedModules, selectedPlan);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        noValidate
      >
        <Field id="name" label="Clinic name" placeholder="Acme Clinic" error={errors.name?.message} inputProps={register("name")} />
        <Field id="slug" label="Slug" placeholder="acme-clinic" mono error={errors.slug?.message} inputProps={register("slug")} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Modules</legend>
          <Controller
            control={control}
            name="modules"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULE_OPTIONS.map((option) => {
                  const checked = field.value.includes(option.module);
                  return (
                    <label
                      key={option.module}
                      className={
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors " +
                        (checked ? "border-primary bg-accent/50" : "border-border hover:bg-muted/50")
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={checked}
                        onChange={(event) => {
                          const next: HepModule[] = event.target.checked
                            ? [...field.value, option.module]
                            : field.value.filter((m) => m !== option.module);
                          field.onChange(next);
                        }}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.blurb}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          />
          {errors.modules?.message && <p className="text-xs text-destructive">{errors.modules.message}</p>}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan">Plan tier</Label>
          <select
            id="plan"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register("plan")}
          >
            {PLAN_TIER_OPTIONS.map((option) => (
              <option key={option.tier} value={option.tier}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Field id="adminEmail" label="Admin email" type="email" placeholder="admin@example.com" error={errors.adminEmail?.message} inputProps={register("adminEmail")} />

        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full sm:w-auto">
          {isSubmitting ? "Onboarding…" : "Onboard tenant"}
        </Button>
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <PricingSummary
          quote={quoteQuery.data}
          isLoading={quoteQuery.isLoading}
          isError={quoteQuery.isError}
          isEmpty={selectedModules.length === 0}
        />
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  error?: string;
  inputProps: ReturnType<ReturnType<typeof useForm<OnboardTenantRequest>>["register"]>;
}

function Field({ id, label, type = "text", placeholder, mono, error, inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={mono ? "h-10 font-mono" : "h-10"}
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
