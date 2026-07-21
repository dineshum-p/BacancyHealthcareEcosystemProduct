import { VisitIntakeDetailPage } from "@/src/features/visit-intakes/VisitIntakeDetailPage";

type PageParams = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageParams) {
  const { id } = await params;
  return <VisitIntakeDetailPage id={id} />;
}
