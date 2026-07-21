import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as selfRegistrationsApi from "@/src/lib/api/selfRegistrationsApi";
import {
  useApproveSelfRegistration,
  useMergeSelfRegistration,
  useRejectSelfRegistration,
} from "./useReviewSelfRegistration";
import { selfRegistrationsQueryKey } from "./useSelfRegistrations";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("self-registration review mutations (BAC-37)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("useApproveSelfRegistration approves and invalidates the queue", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    vi.spyOn(selfRegistrationsApi, "approveSelfRegistration").mockResolvedValue(
      { status: "approved" } as never,
    );

    const { result } = renderHook(() => useApproveSelfRegistration(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate("reg-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(selfRegistrationsApi.approveSelfRegistration).toHaveBeenCalledWith(
      "reg-1",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: selfRegistrationsQueryKey,
    });
  });

  it("useRejectSelfRegistration rejects with a reason and invalidates the queue", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    vi.spyOn(selfRegistrationsApi, "rejectSelfRegistration").mockResolvedValue(
      { status: "rejected" } as never,
    );

    const { result } = renderHook(() => useRejectSelfRegistration(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: "reg-1", reason: "Not legitimate." });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(selfRegistrationsApi.rejectSelfRegistration).toHaveBeenCalledWith(
      "reg-1",
      "Not legitimate.",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: selfRegistrationsQueryKey,
    });
  });

  it("useMergeSelfRegistration merges into a target patient and invalidates the queue", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    vi.spyOn(selfRegistrationsApi, "mergeSelfRegistration").mockResolvedValue(
      { status: "merged" } as never,
    );

    const { result } = renderHook(() => useMergeSelfRegistration(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: "reg-1", targetPatientId: "patient-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(selfRegistrationsApi.mergeSelfRegistration).toHaveBeenCalledWith(
      "reg-1",
      "patient-1",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: selfRegistrationsQueryKey,
    });
  });
});
