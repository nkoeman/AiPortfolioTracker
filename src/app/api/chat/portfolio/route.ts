import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { runPortfolioChat, type PortfolioChatHistoryMessage } from "@/lib/chat/portfolioChat";

export const runtime = "nodejs";

type PortfolioChatRequestBody = {
  message?: unknown;
  history?: unknown;
};

function parseMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseHistory(value: unknown): PortfolioChatHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const entry = row as Record<string, unknown>;
      return {
        role: entry.role === "assistant" ? "assistant" : "user",
        content: typeof entry.content === "string" ? entry.content : ""
      } as PortfolioChatHistoryMessage;
    })
    .filter((row) => row.content.trim().length > 0)
    .slice(-16);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as PortfolioChatRequestBody;
    const message = parseMessage(body.message);
    const history = parseHistory(body.history);

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // User scoping is enforced server-side. The client never provides userId for tool execution.
    const result = await runPortfolioChat({
      userId: user.id,
      message,
      history
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
