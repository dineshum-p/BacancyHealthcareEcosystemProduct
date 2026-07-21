import { EncounterPage } from "@/src/features/encounters/EncounterPage";

type PageParams = { params: Promise<{ patientId: string }> };

export default async function Page({ params }: PageParams) {
  const { patientId } = await params;
  return <EncounterPage patientId={patientId} />;
}
