import { LLMClient } from "./llm";
import { getActiveModelConfig } from "./llm";
import { getPref } from "../utils/prefs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Rough token estimate: ~4 characters per token.
 * Good enough for deciding when to trigger summarization.
 */
export function estimateTokens(messages: Message[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += (m.content ?? "").length;
    if (m.tool_calls) {
      chars += JSON.stringify(m.tool_calls).length;
    }
  }
  return Math.ceil(chars / 4);
}

// ---------------------------------------------------------------------------
// Strip <think> blocks
// ---------------------------------------------------------------------------

/**
 * Remove <think>...</think> blocks from message content.
 * Applied to ALL messages before sending to the LLM so thinking
 * tokens are never fed back as context.
 */
export function stripThinkingTokens(content: string | null): string | null {
  if (!content) return content;
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || null;
}

/**
 * Strip thinking tokens from all messages (in-place).
 */
export function stripAllThinking(messages: Message[]): void {
  for (const m of messages) {
    if (m.content) {
      m.content = stripThinkingTokens(m.content);
    }
  }
}

// ---------------------------------------------------------------------------
// Threshold helpers
// ---------------------------------------------------------------------------

/**
 * Get the effective context limit (tokens).
 * Priority: per-model context_limit > global pref > default 16 000.
 */
export function getContextLimit(): number {
  const activeModel = getActiveModelConfig() as any;
  if (activeModel?.context_limit && Number(activeModel.context_limit) > 0) {
    return Number(activeModel.context_limit);
  }
  const globalLimit = getPref("context_limit") as string;
  if (globalLimit && Number(globalLimit) > 0) {
    return Number(globalLimit);
  }
  return 16_000;
}

const DEFAULT_KEEP_COUNT = 10;

/**
 * Check if summarization should be triggered.
 */
export function shouldSummarize(messages: Message[]): boolean {
  const limit = getContextLimit();
  const tokens = estimateTokens(messages);
  return tokens > limit;
}

// ---------------------------------------------------------------------------
// Safe cutoff
// ---------------------------------------------------------------------------

/**
 * Find a safe cutoff index so that the LAST `keepCount` messages are
 * preserved, without splitting assistant-tool_call / tool-result pairs.
 *
 * Returns the index at which to slice: messages[0..cutoff) are summarized,
 * messages[cutoff..] are kept.
 */
function findSafeCutoff(messages: Message[], keepCount: number): number {
  if (messages.length <= keepCount) return 0;

  const cutoff = messages.length - keepCount;

  // Walk backward from the cutoff to find a safe split point.
  // We must NOT start preserved messages with:
  //  - a tool message (orphaned result)
  //  - an assistant message that has tool_calls (its results would be in the summarized portion)
  for (let i = cutoff; i > 0; i--) {
    const msg = messages[i];
    if (msg.role === "tool") continue; // skip — would orphan the result
    if (
      msg.role === "assistant" &&
      msg.tool_calls &&
      msg.tool_calls.length > 0
    ) {
      continue; // skip — tool results follow this message
    }
    return i;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Summarization prompt
// ---------------------------------------------------------------------------

const SUMMARY_PROMPT = `You are a context extraction assistant. Extract the most important information from the conversation history below.

Focus on:
- Key findings and conclusions
- Decisions that were made
- Tools that were used and their important results
- Unanswered questions or pending tasks
- Important facts, numbers, or data points

Respond ONLY with the extracted context. Be concise but thorough. Do not include any preamble or explanation.`;

// ---------------------------------------------------------------------------
// Core summarization
// ---------------------------------------------------------------------------

/**
 * Summarize older messages using the LLM.
 * Returns the summary text.
 */
async function callSummaryLLM(messagesToSummarize: Message[]): Promise<string> {
  const client = new LLMClient();

  // Format messages for the summary prompt
  const formatted = messagesToSummarize
    .map((m) => {
      const prefix = m.role.toUpperCase();
      const content = m.content || "(no content)";
      if (m.role === "tool") {
        return `TOOL RESULT (${m.tool_call_id}): ${content.substring(0, 500)}`;
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        const toolNames = m.tool_calls
          .map((tc: any) => tc.function?.name || "unknown")
          .join(", ");
        return `${prefix}: ${content}\n[Called tools: ${toolNames}]`;
      }
      return `${prefix}: ${content}`;
    })
    .join("\n\n");

  let summary = "";

  await client.streamChat(
    [
      { role: "system", content: SUMMARY_PROMPT },
      {
        role: "user",
        content: `Here is the conversation history to summarize:\n\n${formatted}`,
      },
    ],
    {
      onToken: (token) => {
        summary += token;
      },
    },
  );

  return summary;
}

/**
 * Apply summarization to the message array.
 *
 * 1. Separate system messages from conversation.
 * 2. Find safe cutoff.
 * 3. Summarize older portion via LLM.
 * 4. Return new message array: [system msgs, summary msg, ...recent msgs].
 */
export async function applySummarization(
  messages: Message[],
): Promise<Message[]> {
  // Separate leading system messages
  const systemMessages: Message[] = [];
  let conversationStart = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "system") {
      systemMessages.push(messages[i]);
      conversationStart = i + 1;
    } else {
      break;
    }
  }

  const conversation = messages.slice(conversationStart);
  const cutoff = findSafeCutoff(conversation, DEFAULT_KEEP_COUNT);

  if (cutoff <= 0) {
    return messages; // nothing to summarize
  }

  const toSummarize = conversation.slice(0, cutoff);
  const toKeep = conversation.slice(cutoff);

  const summaryText = await callSummaryLLM(toSummarize);

  const summaryMessage: Message = {
    role: "system",
    content: `Here is a summary of the earlier conversation:\n\n${summaryText}`,
  };

  return [...systemMessages, summaryMessage, ...toKeep];
}
