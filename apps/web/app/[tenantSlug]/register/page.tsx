import { PublicSelfRegisterPage } from "@/src/features/patient-self-registration/PublicSelfRegisterPage";

export default async function Page({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <PublicSelfRegisterPage tenantSlug={tenantSlug} />;
}
