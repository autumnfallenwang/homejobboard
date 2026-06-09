import OpenAI from "openai";
import { config } from "../config.js";

// The cluster llmgw is OpenAI-compatible, so we use the OpenAI SDK pointed at its
// /v1 base. No real key is needed (the gateway doesn't validate it). Mirrors homenews.
const client = new OpenAI({
  baseURL: `${config.llmGatewayUrl}/v1`,
  apiKey: process.env.LLM_API_KEY ?? "not-needed",
});

export interface ChatOptions {
  model: string;
  systemPrompt?: string;
}

/** Single-shot chat completion. Returns the assistant message text. */
export async function chatCompletion(prompt: string, opts: ChatOptions): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await client.chat.completions.create({
    model: opts.model,
    messages,
    temperature: 0.2, // deterministic-ish for scoring
  });
  return res.choices[0]?.message?.content ?? "";
}
