import { getToolByName, portfolioChatTools } from "@/lib/chat/portfolioTools";

type ChatRole = "system" | "user" | "assistant" | "tool";

export type PortfolioChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatCompletionMessage = {
  role: ChatRole;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      role?: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
};

export type PortfolioChatResult = {
  message: string;
  metadata: {
    model: string;
    toolCalls: Array<{ name: string }>;
    refusal: boolean;
  };
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.1;
const MAX_HISTORY_MESSAGES = 16;
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = [
  "You are Portfolio Assistant for an authenticated portfolio tracker app.",
  "You may answer only using tool-returned portfolio facts and safe general finance education.",
  "Never invent holdings, transactions, exposures, returns, dates, or portfolio values.",
  "If data is missing or partial, explicitly say so.",
  "Distinguish facts from interpretation.",
  "Never provide personalized investment advice, buy/sell recommendations, tax advice, or legal advice.",
  "If asked for advice, refuse briefly and offer descriptive alternatives (performance, concentration, exposures, activity).",
  "Use percentages and EUR values exactly from tool outputs.",
  "Do not mention internal IDs unless the user asks.",
  "Response style rules:",
  "Write for a compact chat panel, not a report.",
  "Keep answers under about 120 words unless the user explicitly asks for detail.",
  "Do not use markdown headings with #, ##, or ###.",
  "Use short paragraphs and simple bullet lists for structured data.",
  "Use bold sparingly and only for brief emphasis or labels.",
  "Avoid long metric dumps and avoid restating large numeric summaries already visible in the UI.",
  "Focus on interpretation, context, drivers, and what stands out.",
  "By default include only a few supporting numbers; provide detailed numeric breakdowns only when explicitly requested.",
  "For broad questions, lead with a concise overall interpretation first, then 2-5 key points.",
  "Preferred structure: one short direct answer, then 2-5 bullets, then an optional short follow-up suggestion.",
  "For exposures, contributors, and breakdowns, prefer bullet lists rather than dense inline comma-separated text.",
  "Do not use em dashes or hyphen separators between clauses.",
  "Prefer commas or periods instead.",
  "Avoid constructions like: Yes-there are.",
  "End with brief follow-up directions only when useful.",
  "Keep the tone practical, natural, and non-repetitive."
].join("\n");

const ADVICE_REFUSAL_MESSAGE =
  "I can't provide personalized investment, tax, or legal advice. I can help with descriptive analysis of your portfolio, such as performance, concentration, contributors, exposures, and transaction history.";

function parseTemperature() {
  const raw = process.env.OPENAI_TEMPERATURE;
  if (!raw) return DEFAULT_TEMPERATURE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TEMPERATURE;
  return Math.max(0, parsed);
}

function normalizeHistory(history: PortfolioChatHistoryMessage[]) {
  return history
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim().length)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000)
    }));
}

function normalizeUserMessage(message: string) {
  return message.trim().slice(0, 4000);
}

// Deterministic pre-guardrail to block direct recommendation/tax/legal requests before model execution.
export function shouldRefuseAdviceRequest(input: string) {
  const normalized = input.toLowerCase();
  const investmentAdvicePattern =
    /\b(what should i|should i|recommend|advice|buy|sell|hold|rebalance|allocate)\b/;
  const taxLegalPattern = /\b(tax|taxes|irs|deduction|legal|lawyer|lawsuit|regulation)\b/;
  const directRecommendationPattern = /\b(best stock|best etf|next investment|what to buy)\b/;

  if (taxLegalPattern.test(normalized)) return true;
  if (directRecommendationPattern.test(normalized)) return true;
  if (
    investmentAdvicePattern.test(normalized) &&
    (normalized.includes(" my ") || normalized.includes(" portfolio") || normalized.includes(" should i "))
  ) {
    return true;
  }
  return false;
}

function buildToolSpec() {
  return portfolioChatTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

async function callOpenAi(messages: ChatCompletionMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: parseTemperature(),
      messages,
      tools: buildToolSpec(),
      tool_choice: "auto"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as OpenAiChatResponse;
}

function safeParseToolArgs(argumentsText: string) {
  try {
    const parsed = JSON.parse(argumentsText) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function executeToolCall(
  userId: string,
  toolName: string,
  args: Record<string, unknown>
) {
  const tool = getToolByName(toolName);
  if (!tool) {
    return {
      ok: false,
      tool: toolName,
      error: "Unsupported tool"
    };
  }

  try {
    return await tool.execute({ userId, now: new Date() }, args);
  } catch (error) {
    return {
      ok: false,
      tool: toolName,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runPortfolioChat(params: {
  userId: string;
  message: string;
  history: PortfolioChatHistoryMessage[];
}): Promise<PortfolioChatResult> {
  const userMessage = normalizeUserMessage(params.message);
  if (!userMessage) {
    return {
      message: "Please enter a question about your portfolio.",
      metadata: { model: DEFAULT_MODEL, toolCalls: [], refusal: false }
    };
  }

  if (shouldRefuseAdviceRequest(userMessage)) {
    return {
      message: ADVICE_REFUSAL_MESSAGE,
      metadata: { model: DEFAULT_MODEL, toolCalls: [], refusal: true }
    };
  }

  const history = normalizeHistory(params.history);
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: userMessage }
  ];

  const executedTools: Array<{ name: string }> = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const completion = await callOpenAi(messages);
    const assistantMessage = completion.choices?.[0]?.message;
    if (!assistantMessage) break;

    const toolCalls = assistantMessage.tool_calls || [];
    if (!toolCalls.length) {
      const content = assistantMessage.content?.trim();
      return {
        message: content && content.length ? content : "I could not generate a response.",
        metadata: { model: DEFAULT_MODEL, toolCalls: executedTools, refusal: false }
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content || null,
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      const args = safeParseToolArgs(toolCall.function.arguments);
      const result = await executeToolCall(params.userId, toolCall.function.name, args);
      executedTools.push({ name: toolCall.function.name });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    message: "I was unable to complete that request right now. Please try rephrasing your question.",
    metadata: { model: DEFAULT_MODEL, toolCalls: executedTools, refusal: false }
  };
}
