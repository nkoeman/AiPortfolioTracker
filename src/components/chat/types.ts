export type PortfolioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type PortfolioChatApiResult = {
  message: string;
  metadata: {
    model: string;
    toolCalls: Array<{ name: string }>;
    refusal: boolean;
  };
};
