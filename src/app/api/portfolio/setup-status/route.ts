import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getPortfolioSetupStatus } from "@/lib/portfolio/setupStatus";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getPortfolioSetupStatus(user.id);
  return NextResponse.json(status);
}
