import { redirect } from "next/navigation";
import { PortfolioSetupScreen } from "@/components/PortfolioSetupScreen";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getPortfolioSetupStatus } from "@/lib/portfolio/setupStatus";

export default async function PortfolioSetupPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/sign-in");

  const status = await getPortfolioSetupStatus(user.id);

  return (
    <PageContainer>
      <PortfolioSetupScreen initialStatus={status} />
    </PageContainer>
  );
}
