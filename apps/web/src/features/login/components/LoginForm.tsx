"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Mirrors `services/auth`'s `LoginDto` constraints (BAC-5) for fast
 * client-side feedback -- the server remains the source of truth and
 * re-validates independently; this is a UX convenience only.
 *
 * `tenantId` has no server-side DTO counterpart -- it maps to the
 * `X-Tenant-Id` header `TenantGuard` requires on every auth route (BAC-5).
 * This app has no subdomain-based tenant resolution yet, so the login
 * screen must collect the caller's workspace (tenant id or slug) explicitly
 * rather than inferring it, hence this extra field beyond email/password.
 */
const loginSchema = z.object({
  tenantId: z.string().trim().min(1, "Workspace is required").max(64),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(320),
  password: z.string().min(1, "Password is required").max(200),
});

export interface LoginFormValues {
  tenantId: string;
  email: string;
  password: string;
}

export interface LoginFormProps {
  onSubmit: (input: LoginFormValues) => void;
  isSubmitting: boolean;
}

/** BAC-13, AC1: the login step -- workspace, email, and password. */
export function LoginForm({ onSubmit, isSubmitting }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantId: "", email: "", password: "" },
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
        {isSubmitting ? "Signing in…" : "Sign in"}
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
  inputProps: ReturnType<ReturnType<typeof useForm<LoginFormValues>>["register"]>;
}

function Field({ id, label, type = "text", placeholder, error, inputProps }: FieldProps) {
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
