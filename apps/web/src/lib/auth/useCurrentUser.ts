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

/**
 * Resolves the caller's identity/role from the stored access token
 * (BAC-12, AC4) via `useSyncExternalStore` -- the React-sanctioned way to
 * read an external mutable source (here, `localStorage`) without the
 * effect+setState anti-pattern (`react-hooks/set-state-in-effect`), and
 * without a hydration mismatch: `getServerSnapshot` returns `null` (no
 * `localStorage` on the server), so `isLoading` is only ever `true` for the
 * very first (server-rendered/pre-hydration) render.
 */
export function useCurrentUser(): CurrentUserState {
  const token = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (typeof window === "undefined") {
    return { user: null, isLoading: true };
  }

  return { user: token ? decodeAccessToken(token) : null, isLoading: false };
}
