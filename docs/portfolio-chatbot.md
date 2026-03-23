# Portfolio Chatbot Architecture

## Flow
1. Frontend (`PortfolioChatWidget`) sends `{ message, history }` to `POST /api/chat/portfolio`.
2. API route authenticates via `getServerSession`, resolves the signed-in user, and never accepts `userId` from the client.
3. `runPortfolioChat` calls OpenAI Chat Completions with a restricted tool list.
4. When the model requests tools, server executes them in `portfolioTools.ts` using the authenticated `userId`.
5. Tool JSON results are sent back to the model to produce the final assistant response.
6. Frontend renders the response in the overlay.

## Tool Definitions
- File: `src/lib/chat/portfolioTools.ts`
- Tools expose compact JSON only:
  - `getPortfolioOverview`
  - `getPerformanceSummary`
  - `getTopContributors`
  - `getTopDetractors`
  - `getExposureBreakdown`
  - `getTransactions`
  - `getLargestPositions`
  - `getPositionDetails`
  - `getRecentPortfolioChanges`
  - `getMethodologyExplanation`

## Guardrails
- System prompt blocks advice-style behavior.
- Deterministic pre-check (`shouldRefuseAdviceRequest`) rejects direct buy/sell, tax, and legal advice requests before model execution.
- Tools are user-scoped and only return data for the authenticated session user.
- Model has no direct database access.

## Extending
1. Add a new tool implementation in `portfolioTools.ts`.
2. Add JSON schema definition and description in the `portfolioChatTools` registry.
3. Keep outputs compact and deterministic.
4. Reuse existing portfolio services/utilities where possible to preserve canonical calculations.
