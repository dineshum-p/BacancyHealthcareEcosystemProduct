"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

/** Mirrors `services/auth`'s `MfaLoginVerifyDto.totpCode` pattern (BAC-6) for fast client-side feedback. */
const mfaChallengeSchema = z.object({
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

interface MfaChallengeFormValues {
  totpCode: string;
}

export interface MfaChallengeFormProps {
  onSubmit: (totpCode: string) => void;
  isSubmitting: boolean;
}

/** BAC-13, AC2: the second login step -- a 6-digit TOTP code from the caller's authenticator app. */
export function MfaChallengeForm({
  onSubmit,
  isSubmitting,
}: MfaChallengeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaChallengeFormValues>({
    resolver: zodResolver(mfaChallengeSchema),
    defaultValues: { totpCode: "" },
  });

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) =>
        void handleSubmit((values) => onSubmit(values.totpCode))(event)
      }
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="totpCode"
          className="text-sm font-medium text-zinc-800"
        >
          Authentication code
        </label>
        <input
          id="totpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          {...register("totpCode")}
        />
        {errors.totpCode?.message && (
          <p className="text-xs text-red-700">{errors.totpCode.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
