import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getTopMoversByRange } from "@/lib/dashboard/topMoversByRange";
import type { PerformanceRangeOption } from "@/lib/charts/performanceRange";

const PERFORMANCE_RANGES: PerformanceRangeOption[] = ["max", "ytd", "1y", "1m"];

function isPerformanceRange(value: string): value is PerformanceRangeOption {
  return PERFORMANCE_RANGES.includes(value as PerformanceRangeOption);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const rawRange = (url.searchParams.get("range") || "max").toLowerCase();
    if (!isPerformanceRange(rawRange)) {
      return NextResponse.json(
        { error: "Invalid range. Allowed values: max, ytd, 1y, 1m." },
        { status: 400 }
      );
    }

    const payload = await getTopMoversByRange(user.id, rawRange);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Top movers request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
