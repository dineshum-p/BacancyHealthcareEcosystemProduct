"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      className="flex w-full flex-col gap-5"
      onSubmit={(event) =>
        void handleSubmit((values) => onSubmit(values.totpCode))(event)
      }
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totpCode">Authentication code</Label>
        <Input
          id="totpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-invalid={Boolean(errors.totpCode?.message)}
          className="h-10 font-mono tracking-[0.3em]"
          {...register("totpCode")}
        />
        {errors.totpCode?.message && (
          <p className="text-xs text-destructive">{errors.totpCode.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}
