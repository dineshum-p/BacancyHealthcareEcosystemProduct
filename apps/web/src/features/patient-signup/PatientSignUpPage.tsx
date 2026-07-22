"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthTokens } from "@hep/shared-types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Wordmark } from "@/src/components/brand/Wordmark";
import { completeLogin } from "@/src/features/login/completeLogin";
import { useLogin } from "@/src/features/login/hooks/useLogin";
import { useSignUpPatient } from "./hooks/useSignUpPatient";
import {
  PatientSignUpForm,
  type PatientSignUpFormValues,
} from "./components/PatientSignUpForm";

export interface PatientSignUpPageProps {
  /**
   * BAC-38 pattern (matches `LoginPage.initialTenantSlug`): the tenant slug
   * already resolved server-side from this request's subdomain, if any --
   * pre-fills the workspace field the same way `/login` does.
   */
  initialTenantSlug?: string;
}

/**
 * BAC-43, `/signup`. Reachable via the "Sign up" link on `/login`. Creates a
 * login-capable patient account through `POST /auth/patients/register`
 * (BAC-42, via `useSignUpPatient`), which deliberately issues no tokens of
 * its own (see `RegisteredUser`'s doc comment in `@hep/shared-types`).
 *
 * UX decision: rather than bouncing the caller back to `/login` to retype
 * their just-entered password, this immediately calls the existing
 * `useLogin` mutation with the same credentials to complete the sign-in in
 * one screen -- the same "chain a second auth call off the first's success"
 * shape `LoginPage`'s own `LoginFlow` already uses for its MFA step. If that
 * second call doesn't yield tokens for any reason (a transient error, or --
 * in principle -- MFA already enabled on the account, though a freshly
 * created account never has MFA configured), this falls back to a "your
 * account was created, please sign in" prompt linking to `/login` rather
 * than leaving the caller on a dead end.
 */
export function PatientSignUpPage({
  initialTenantSlug,
}: PatientSignUpPageProps = {}) {
  const router = useRouter();
  const signUpMutation = useSignUpPatient();
  const loginMutation = useLogin();
  /**
   * Whether the auto-login step (see the doc comment above) didn't
   * complete after a successful sign-up -- tracked as local state, not
   * derived from `loginMutation`'s own flags, since the fallback decision
   * needs to persist independently of whatever `loginMutation` does next.
   */
  const [needsManualSignIn, setNeedsManualSignIn] = useState(false);

  function handleSubmit(values: PatientSignUpFormValues) {
    setNeedsManualSignIn(false);
    const { tenantId, email, password } = values;
    signUpMutation.mutate(values, {
      onSuccess: () => {
        loginMutation.mutate(
          { tenantId, email, password },
          {
            onSuccess: (result) => {
              // BAC-49 added a third `LoginResult` shape
              // (`PasswordResetRequiredChallenge`) that, like `MfaChallenge`,
              // is not a complete `AuthTokens` pair -- a freshly
              // self-registered patient account never has
              // `mustResetPassword: true` (that only applies to BAC-48's
              // admin-provisioned provider accounts), so this falls back to
              // the same "please sign in manually" state already used for
              // any other non-token outcome here.
              if ("mfaRequired" in result || "passwordResetRequired" in result) {
                setNeedsManualSignIn(true);
              } else {
                completeLoginAndRedirect(result);
              }
            },
            onError: () => setNeedsManualSignIn(true),
          },
        );
      },
    });
  }

  function completeLoginAndRedirect(tokens: AuthTokens) {
    router.replace(completeLogin(tokens));
  }

  const isSubmitting = signUpMutation.isPending || loginMutation.isPending;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <Wordmark />

      <Card className="w-full max-w-sm border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign up for patient access to your workspace.
          </p>
        </CardHeader>
        <CardContent>
          {needsManualSignIn ? (
            <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Account created — please sign in.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We couldn&apos;t sign you in automatically, but your account
                is ready.
              </p>
            </div>
          ) : (
            <>
              <PatientSignUpForm
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                defaultTenantId={initialTenantSlug}
              />

              {signUpMutation.isError && (
                <p className="mt-4 text-sm text-destructive">
                  {signUpMutation.error instanceof Error
                    ? signUpMutation.error.message
                    : "Something went wrong. Please try again."}
                </p>
              )}
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
