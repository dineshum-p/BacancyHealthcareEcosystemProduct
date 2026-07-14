"use client";

import { useSyncExternalStore } from "react";
import type { AccessTokenPayload } from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "./session";

export interface CurrentUserState {
  user: AccessTokenPayload | null;
  /** `true` only for the server-rendered/pre-hydration snapshot. */
  isLoading: boolean;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getClientSnapshot(): string | null {
  return getStoredAccessToken();
}

function getServerSnapshot(): string | null {
  return null;
}

/** Never actually fires -- hydration status only ever changes via React's own hydration replacement pass, not an external event. */
function subscribeNoop(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getUnhydratedServerSnapshot(): boolean {
  return false;
}

/**
 * Resolves the caller's identity/role from the stored access token
 * (BAC-12, AC4) via `useSyncExternalStore` -- the React-sanctioned way to
 * read an external mutable source (here, `localStorage`) without the
 * effect+setState anti-pattern (`react-hooks/set-state-in-effect`).
 *
 * `isLoading` is derived from a SECOND `useSyncExternalStore` (a common
 * "has this component finished its hydration-matching render yet" probe)
 * rather than a `typeof window === "undefined"` check: that check is only
 * ever true during the actual Node.js SSR pass, but is already `false`
 * during the BROWSER's first (hydration-matching) render -- which is a real
 * client render, just one that must still return the server's `null`
 * token/`isLoading: true` output to match the SSR HTML. Using
 * `typeof window` there caused `RequireRole` to compute `isLoading: false`
 * (and briefly render `ForbiddenView`) on that very first client render,
 * one render before React's own hydration-replacement pass corrected it --
 * a real (if self-healing) hydration mismatch. Mirroring `token`/`user`'s
 * own server/client-snapshot split for `isLoading` keeps both values
 * consistent across the SSR render, the hydration-matching render, and the
 * post-hydration render, with no mismatch in between.
 */
export function useCurrentUser(): CurrentUserState {
  const token = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    getHydratedSnapshot,
    getUnhydratedServerSnapshot,
  );

  if (!isHydrated) {
    return { user: null, isLoading: true };
  }

  return { user: token ? decodeAccessToken(token) : null, isLoading: false };
}
