"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <Field
        id="tenantId"
        label="Workspace"
        error={errors.tenantId?.message}
        inputProps={register("tenantId")}
      />
      <Field
        id="email"
        label="Email"
        type="email"
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  error?: string;
  inputProps: ReturnType<ReturnType<typeof useForm<LoginFormValues>>["register"]>;
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
