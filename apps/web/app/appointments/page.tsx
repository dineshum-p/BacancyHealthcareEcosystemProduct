import { SchedulePage } from "@/src/features/scheduling/SchedulePage";

type PageParams = {
  searchParams: Promise<{ patientId?: string; patientName?: string }>;
};

export default async function Page({ searchParams }: PageParams) {
  const { patientId, patientName } = await searchParams;
  return (
    <SchedulePage
      preselectedPatientId={patientId}
      preselectedPatientName={patientName}
    />
  );
}
