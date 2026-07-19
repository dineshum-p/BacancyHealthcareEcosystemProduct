import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PaginatedPatientsResponse } from "@hep/shared-types";
import * as patientsApi from "@/src/lib/api/patientsApi";
import { useSearchPatients } from "./useSearchPatients";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function Probe({ name }: { name?: string }) {
  const { data, isLoading, isError } = useSearchPatients({ name, page: 1 });
  if (isLoading) return <div>loading patients</div>;
  if (isError) return <div>error loading patients</div>;
  return <div>{data?.items.length ?? 0} patients</div>;
}

describe("useSearchPatients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state", () => {
    vi.spyOn(patientsApi, "searchPatients").mockReturnValue(
      new Promise(() => {}),
    );
    renderWithClient(<Probe />);
    expect(screen.getByText("loading patients")).toBeInTheDocument();
  });

  it("resolves with the fetched patients, passing the query through (AC2)", async () => {
    const response: PaginatedPatientsResponse = {
      items: [
        {
          id: "p1",
          tenantId: "tenant-1",
          mrn: "MRN-0001",
          firstName: "Jane",
          lastName: "Doe",
          dateOfBirth: "1990-05-12",
          gender: null,
          phone: null,
          email: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    };
    vi.spyOn(patientsApi, "searchPatients").mockResolvedValue(response);

    renderWithClient(<Probe name="Jane" />);

    expect(await screen.findByText("1 patients")).toBeInTheDocument();
    expect(patientsApi.searchPatients).toHaveBeenCalledWith({
      name: "Jane",
      page: 1,
    });
  });

  it("surfaces a fetch failure", async () => {
    vi.spyOn(patientsApi, "searchPatients").mockRejectedValue(
      new Error("boom"),
    );

    renderWithClient(<Probe />);

    expect(
      await screen.findByText("error loading patients"),
    ).toBeInTheDocument();
  });
});
