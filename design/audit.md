# ETFMinded — Design Audit

## Issues found in current UI

### 1. Visual hierarchy is flat
- Every card looks the same: same border, same shadow, same padding, same H2.
- Hero metric (portfolio value) is buried in a chart card with the same weight as a small "Recent performance" card.
- No clear "this is the most important number on the page" moment.

### 2. Brand inconsistency
- Two logo treatments side-by-side (`brand-logo-full` + `brand-logo-mark`) — should be one.
- `BrandMotif` SVG appears on auth/empty cards but not consistently — feels random.
- Sidebar uses Inter; "ETFMinded" wordmark in image; no clear brand voice.

### 3. Color overuse
- Emerald green (`--brand`) is used for: active nav, primary buttons, positive numbers, focus rings, summary quote border, exposure chart slices, motif. It loses meaning.
- Pie chart uses 9 saturated rainbow colors that don't relate to brand.
- No semantic separation between "brand action" and "positive value".

### 4. Typography & numbers
- All numbers in the same Inter family — losing tabular alignment in tables despite `font-variant-numeric: tabular-nums`.
- Headings use `clamp()` so size shifts unpredictably on resize.
- "What happend in your portfolio" — typo in production copy.
- "Gainers & losers" lowercase, "Open Positions" Title Case — inconsistent.

### 5. Information density
- Portfolio table: 8 columns of dense numbers, no visual grouping, no banding, no row affordance for click-into-detail.
- "Profile tags" rendered as `tag1 | tag2 | tag3` text — should be pills.
- Closed positions table: only 5 columns, feels under-built next to open positions.

### 6. Empty/loading states
- `<small>Loading gainers and losers...</small>` — bare text, no skeleton.
- "No transactions yet. Import your DeGiro CSV to get started." — no CTA button, no illustration, no path forward.

### 7. Layout
- Sidebar nav has 3 items with no icons, no grouping.
- Sign-out is a duplicate (UserButton + Sign out button stacked).
- Mobile topbar has logo centered + hamburger absolutely positioned — fragile.
- `.section-title { display: none; }` — dead markup everywhere.

### 8. Charts
- Recharts default tooltips don't match the surface styling.
- Exposure pie chart has a hard-coded 9-color palette that fights the green brand.
- Top movers bar chart and portfolio chart use different visual languages.

---

## Recommended improvements (shown in redesign)

### Foundations
- **Type pairing**: Inter (UI) + JetBrains Mono (numbers in tables, KPIs, axes). Tabular alignment becomes obvious.
- **Color discipline**:
  - One brand accent (emerald `oklch(72% 0.16 155)`) for navigation + brand mark only.
  - Positive: a separate, slightly bluer green (`oklch(64% 0.14 160)`) so brand ≠ "good".
  - Negative: warm rose (`oklch(62% 0.16 25)`).
  - Neutrals: warm-tinted whites (`oklch(98% 0.005 150)`) so the surface feels intentional, not Bootstrap white.
- **Shape**: 12px card radius, 6px inner radius — current `--radius-lg: 16px` is too rounded for a finance product.
- **Density**: tables get 32px row height, banded; KPI tiles get a hero variant for the primary number.

### Performance page
- Hero KPI strip pulled out of the chart card: Total value, Today, Total return %, Total gain €. Each one large, scannable, with sparkline.
- Chart card becomes a focused single artifact with range chips (1M / YTD / 1Y / Max) instead of dual select dropdowns.
- "Gainers & losers" + AI summary become a balanced two-column "intelligence" row.

### Portfolio page
- **Allocation header**: a single horizontal stacked bar showing region/sector/development at-a-glance, with the full pie chart on demand.
- **Holdings table redesign**:
  - Mono-font numerics, right-aligned.
  - Sparkline column showing last-30-day price.
  - Tag pills (asset type / region) as actual chips.
  - Inline % bar showing each position as % of portfolio.
- Closed positions becomes a collapsible secondary section, not equal weight.

### Transactions page
- Top action bar combines Sync Prices + Add Transaction + Import CSV — one toolbar instead of three separate cards.
- Transactions table gets buy/sell tags as colored pills instead of plain text.
- Empty state gets an illustrated CTA card.

### Navigation
- Sidebar gets icons + a small "data freshness" indicator at the bottom (last sync time).
- One auth control, not two.
- Section divider between Performance / Portfolio / Transactions ↔ a "Settings" group.
