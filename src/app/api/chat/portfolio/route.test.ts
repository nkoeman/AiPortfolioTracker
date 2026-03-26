import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAppUser: vi.fn(),
  runPortfolioChat: vi.fn()
}));

vi.mock("@/lib/auth/appUser", () => ({
  getCurrentAppUser: mocks.getCurrentAppUser
}));

vi.mock("@/lib/chat/portfolioChat", () => ({
  runPortfolioChat: mocks.runPortfolioChat
}));

import { POST } from "@/app/api/chat/portfolio/route";

describe("POST /api/chat/portfolio", () => {
  beforeEach(() => {
    mocks.getCurrentAppUser.mockReset();
    mocks.runPortfolioChat.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getCurrentAppUser.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/chat/portfolio", {
        method: "POST",
        body: JSON.stringify({ message: "test" })
      })
    );

    expect(response.status).toBe(401);
  });

  it("executes chat using authenticated user id only", async () => {
    mocks.getCurrentAppUser.mockResolvedValue({ id: "user_1", email: "user@example.com", name: null, clerkUserId: "clerk_1" });
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
