import { redirect } from "next/navigation";
import { PortfolioAiSummaryCardClient } from "@/components/PortfolioAiSummaryCardClient";
import { PortfolioSetupScreen } from "@/components/PortfolioSetupScreen";
import { AppIcon } from "@/components/icons/AppIcon";
import { InsightsAssistant } from "@/components/insights/InsightsAssistant";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getTopMoversByRange, type TopMoversRangeContributor } from "@/lib/dashboard/topMoversByRange";
import { getPortfolioExposure, type PortfolioExposureResponse, type PortfolioExposureSlice } from "@/lib/exposure/portfolioExposure";
import { getPortfolioSetupStatus, shouldBlockPortfolioAnalytics } from "@/lib/portfolio/setupStatus";

type HighlightTone = "accent" | "pos" | "warn" | "neg";

type HighlightCard = {
  icon: "portfolio" | "performance" | "insights";
  tone: HighlightTone;
  label: string;
  value: string;
  note: string;
  bar: number;
};

const eurFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatWeight(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedEur(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "\u2014";
  if (value > 0) return `+${eurFormatter.format(value)}`;
  if (value < 0) return `-${eurFormatter.format(Math.abs(value))}`;
  return eurFormatter.format(0);
}

function firstValidSlice(rows: PortfolioExposureSlice[]) {
  return rows.find((row) => row.key !== "NO_DATA" && row.value > 0) || null;
}

function buildConcentrationCard(exposure: PortfolioExposureResponse): HighlightCard | null {
  const largestRegion = firstValidSlice(exposure.charts.region);
  if (!largestRegion) return null;
  return {
    icon: "portfolio",
    tone: "accent",
    label: "Concentration",
    value: `${formatWeight(largestRegion.value)} ${largestRegion.label}`,
    note: `${largestRegion.label} is your largest regional exposure.`,
    bar: Math.min(100, Math.max(4, largestRegion.value * 100))
  };
}

function buildContributorCard(row: TopMoversRangeContributor | undefined): HighlightCard | null {
  if (!row) return null;
  return {
    icon: "performance",
    tone: "pos",
    label: "Top contributor",
    value: `${row.instrumentName} ${formatSignedEur(row.contributionEur)}`,
    note: "This holding contributed most over the latest 1M window.",
    bar: Math.min(100, Math.max(8, Math.abs(row.localReturnPct || 0) * 100))
  };
}

function buildDragCard(row: TopMoversRangeContributor | undefined): HighlightCard | null {
  if (!row) return null;
  return {
    icon: "insights",
    tone: "neg",
    label: "Biggest drag",
    value: `${row.instrumentName} ${formatSignedEur(row.contributionEur)}`,
    note: "This holding detracted most over the latest 1M window.",
    bar: Math.min(100, Math.max(8, Math.abs(row.localReturnPct || 0) * 100))
  };
}

function buildDiversificationCard(exposure: PortfolioExposureResponse): HighlightCard | null {
  const sectorRows = exposure.charts.sector.filter((row) => row.key !== "NO_DATA" && row.value > 0);
  const topSector = firstValidSlice(sectorRows);
  if (!topSector || !sectorRows.length) return null;
  return {
    icon: "portfolio",
    tone: "accent",
    label: "Diversification",
    value: `${sectorRows.length} sectors`,
    note: `${topSector.label} leads at ${formatWeight(topSector.value)}.`,
    bar: Math.min(100, Math.max(4, topSector.value * 100))
  };
}

function buildStarterPrompts(exposure: PortfolioExposureResponse, hasTopMovers: boolean) {
  const prompts: string[] = [];
  if (exposure.charts.region.length) prompts.push("How concentrated am I?");
  if (exposure.charts.country.some((row) => row.key === "US" && row.value > 0)) prompts.push("What's my US exposure?");
  if (hasTopMovers) prompts.push("Which holding contributed most this month?");
  if (exposure.charts.sector.length) prompts.push("Show my sector exposure");
  return prompts.slice(0, 4);
}

function InsightHighlightCards({ cards }: { cards: HighlightCard[] }) {
  if (!cards.length) return null;

  return (
    <div className="insight-cards">
      {cards.map((card) => (
        <div className="insight-card" key={card.label}>
          <div className="insight-card-top">
            <div className={`insight-ic ${card.tone}`}>
              <AppIcon name={card.icon} size={16} />
            </div>
            <div className="insight-card-label">{card.label}</div>
          </div>
          <div className="insight-card-value">{card.value}</div>
          <div className="insight-card-note">{card.note}</div>
          <div className="insight-bar">
            <span className={`insight-bar-fill ${card.tone}`} style={{ width: `${card.bar}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function InsightsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/sign-in");

  const setupStatus = await getPortfolioSetupStatus(user.id);
  if (shouldBlockPortfolioAnalytics(setupStatus)) {
    return (
      <PageContainer>
        <PortfolioSetupScreen initialStatus={setupStatus} />
      </PageContainer>
    );
  }

  const [exposure, topMovers] = await Promise.all([
    getPortfolioExposure(user.id),
    getTopMoversByRange(user.id, "1m")
  ]);

  const topContributor = topMovers.contributors.topGainers[0];
  const biggestDrag = topMovers.contributors.topLosers[0];
  const cards = [
    buildConcentrationCard(exposure),
    buildContributorCard(topContributor),
    buildDragCard(biggestDrag),
    buildDiversificationCard(exposure)
  ].filter((card): card is HighlightCard => card !== null);
  const starterPrompts = buildStarterPrompts(exposure, Boolean(topContributor || biggestDrag));

  return (
    <PageContainer>
      <div className="page-stack insights-page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Insights</h1>
            <p className="page-sub">AI analysis of your portfolio · refreshed after each market close</p>
          </div>
        </div>

        <Section>
          <div className="insights-grid">
            <div className="insights-main">
              <PortfolioAiSummaryCardClient />
              <InsightHighlightCards cards={cards} />
            </div>
            <InsightsAssistant starterPrompts={starterPrompts} />
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
