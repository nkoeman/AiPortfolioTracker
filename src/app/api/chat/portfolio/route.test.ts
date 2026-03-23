import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  runPortfolioChat: vi.fn()
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession
}));

vi.mock("@/lib/auth/options", () => ({
  authOptions: {}
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique
    }
  }
}));

vi.mock("@/lib/chat/portfolioChat", () => ({
  runPortfolioChat: mocks.runPortfolioChat
}));

import { POST } from "@/app/api/chat/portfolio/route";

describe("POST /api/chat/portfolio", () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.runPortfolioChat.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/chat/portfolio", {
        method: "POST",
        body: JSON.stringify({ message: "test" })
      })
    );

    expect(response.status).toBe(401);
  });

  it("executes chat using authenticated user id only", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user_1" });
    mocks.runPortfolioChat.mockResolvedValue({
      message: "Summary",
      metadata: { model: "gpt-4o-mini", toolCalls: [], refusal: false }
    });

    const response = await POST(
      new Request("http://localhost/api/chat/portfolio", {
        method: "POST",
        body: JSON.stringify({
          message: "How did my portfolio perform?",
          history: [{ role: "user", content: "Earlier" }],
          userId: "malicious_user"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runPortfolioChat).toHaveBeenCalledWith({
      userId: "user_1",
      message: "How did my portfolio perform?",
      history: [{ role: "user", content: "Earlier" }]
    });
    expect(body.message).toBe("Summary");
  });
});
