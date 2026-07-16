"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthTokens } from "@hep/shared-types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Wordmark } from "@/src/components/brand/Wordmark";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { resolveDashboardPath } from "@/src/lib/auth/dashboardPath";
import { completeLogin } from "./completeLogin";
import { useLogin, type LoginInput } from "./hooks/useLogin";
import { useVerifyMfaLogin } from "./hooks/useVerifyMfaLogin";
import { LoginForm, type LoginFormValues } from "./components/LoginForm";
import { MfaChallengeForm } from "./components/MfaChallengeForm";

interface MfaChallengeState {
  tenantId: string;
  mfaChallengeToken: string;
}

/**
 * BAC-13, `/login`. AC4: a caller who is already signed in is redirected
 * away immediately (via `router.replace` in an effect -- a genuine
 * navigation side effect, not derived render state, so this is not the
 * `useSyncExternalStore`-worthy case `useCurrentUser`'s doc comment
 * describes) rather than ever flashing the login form.
 */
export function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(resolveDashboardPath(user.role));
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return null;
  }

  function handleAuthenticated(tokens: AuthTokens) {
    router.replace(completeLogin(tokens));
  }

  return <LoginFlow onAuthenticated={handleAuthenticated} />;
}

interface LoginFlowProps {
  onAuthenticated: (tokens: AuthTokens) => void;
}

/**
 * AC1/AC2/AC3: the two-step credentials -> (optional) TOTP flow.
 * `mfaChallengeToken`/the workspace the caller submitted are held in local
 * state only long enough to complete the second step -- neither is
 * persisted, matching `MfaChallenge`'s doc comment that the challenge token
 * is single-purpose and short-lived.
 */
function LoginFlow({ onAuthenticated }: LoginFlowProps) {
  const [challenge, setChallenge] = useState<MfaChallengeState | null>(null);
  const loginMutation = useLogin();
  const verifyMutation = useVerifyMfaLogin();

  function handleLoginSubmit(values: LoginFormValues) {
    const input: LoginInput = values;
    loginMutation.mutate(input, {
      onSuccess: (result) => {
        if ("mfaRequired" in result) {
          setChallenge({
            tenantId: input.tenantId,
            mfaChallengeToken: result.mfaChallengeToken,
          });
        } else {
          onAuthenticated(result);
        }
      },
    });
  }

  function handleMfaSubmit(totpCode: string) {
    if (!challenge) {
      return;
    }
    verifyMutation.mutate(
      {
        tenantId: challenge.tenantId,
        mfaChallengeToken: challenge.mfaChallengeToken,
        totpCode,
      },
      { onSuccess: onAuthenticated },
    );
  }

  const isSubmitting = challenge
    ? verifyMutation.isPending
    : loginMutation.isPending;
  const isError = challenge ? verifyMutation.isError : loginMutation.isError;
  const error = challenge ? verifyMutation.error : loginMutation.error;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <Wordmark />

      <Card className="w-full max-w-sm border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            {challenge ? "Verify it's you" : "Sign in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {challenge
              ? "Enter the code from your authenticator app to finish signing in."
              : "Enter your workspace and credentials to continue."}
          </p>
        </CardHeader>
        <CardContent>
          {challenge ? (
            <MfaChallengeForm
              onSubmit={handleMfaSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <LoginForm onSubmit={handleLoginSubmit} isSubmitting={isSubmitting} />
          )}

          {isError && (
            <p className="mt-4 text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Something went wrong. Please try again."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
