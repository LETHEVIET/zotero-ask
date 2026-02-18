import "../utils/polyfills";
import { getPref, setPref } from "../utils/prefs";
// Import Tool interface (avoiding circular dependency by just using type here if possible, or import)
import { type Tool } from "./tools";

export type ModelConfig = {
  id: string;
  name: string;
  api_url: string;
  api_keys: string[];
  model: string;
  context_limit?: number; // per-model token limit override
};

// Round-robin key index tracker (per model id)
const keyIndexMap = new Map<string, number>();

function getNextApiKey(config: ModelConfig): string {
  const keys = config.api_keys.filter((k) => k.trim().length > 0);
  if (keys.length === 0) return "";
  if (keys.length === 1) return keys[0];
  const currentIdx = keyIndexMap.get(config.id) ?? 0;
  const key = keys[currentIdx % keys.length];
  keyIndexMap.set(config.id, (currentIdx + 1) % keys.length);
  return key;
}

export function getModels(): ModelConfig[] {
  try {
    const json = (getPref("models") as string) || "[]";
    let models = JSON.parse(json) as any[];
    // Backward compat: convert legacy api_key string to api_keys array
    models = models.map((m) => {
      if (typeof m.api_key === "string" && !m.api_keys) {
        return { ...m, api_keys: [m.api_key], api_key: undefined };
      }
      if (!m.api_keys) m.api_keys = [];
      return m;
    }) as ModelConfig[];
    if (models.length > 0) return models;
  } catch (_e) {
    // fall through
  }
  // Migration fallback: build from legacy prefs
  const legacyKey = (getPref("api_key") as string) || "";
  const legacyUrl =
    (getPref("api_url") as string) || "https://api.openai.com/v1";
  const legacyModel = (getPref("model") as string) || "gpt-4o";
  if (legacyKey || legacyUrl || legacyModel) {
    const migrated: ModelConfig = {
      id: Math.random().toString(36).substring(2, 11),
      name: legacyModel || "Default",
      api_url: legacyUrl,
      api_keys: legacyKey ? [legacyKey] : [],
      model: legacyModel,
    };
    return [migrated];
  }
  return [];
}

export function getActiveModelConfig(): ModelConfig | null {
  const models = getModels();
  if (models.length === 0) return null;
  const activeId = (getPref("active_model_id") as string) || "";
  return models.find((m) => m.id === activeId) || models[0];
}

export function setActiveModelId(id: string) {
  setPref("active_model_id" as any, id);
}

type LLMStreamCallbacks = {
  onToken: (token: string) => void;
  onToolCall?: (toolName: string) => void;
  onComplete?: (
    fullContent: string,
    toolCalls: any[],
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    },
  ) => void | Promise<void>;
  onError?: (error: Error) => void;
  onRequestDebug?: (body: any) => void;
};

export class LLMClient {
  async streamChat(
    messages: {
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
      tool_calls?: any[];
      tool_call_id?: string;
    }[],
    callbacks: LLMStreamCallbacks,
    tools?: any[], // OpenAITools format
  ) {
    try {
      const activeModel = getActiveModelConfig();
      const apiKey = activeModel ? getNextApiKey(activeModel) : "";
      let baseURL = activeModel?.api_url || "https://api.openai.com/v1";
      const model = activeModel?.model || "gpt-4o";

      if (baseURL.endsWith("/")) {
        baseURL = baseURL.slice(0, -1);
      }

      const url = `${baseURL}/chat/completions`;

      const body: any = {
        model: model,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      if (callbacks.onRequestDebug) {
        callbacks.onRequestDebug(body);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // Tool Call Accumulation
      const currentToolCalls: any[] = [];
      let accumulatedContent = "";
      let usage:
        | {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          }
        | undefined;

      while (true) {
        const { done, value } = await (reader as any).read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6);
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;

            // Handle Content
            if (delta?.content) {
              accumulatedContent += delta.content;
              callbacks.onToken(delta.content);
            }

            // Capture usage from the final chunk
            if (data.usage) {
              usage = data.usage;
            }

            // Handle Tool Calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index;
                if (!currentToolCalls[index]) {
                  currentToolCalls[index] = {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: {
                      name: toolCall.function?.name || "",
                      arguments: toolCall.function?.arguments || "",
                    },
                  };
                  // Notify that a tool call is starting/detected
                  if (callbacks.onToolCall) {
                    callbacks.onToolCall(
                      currentToolCalls[index].function.name || "unknown",
                    );
                  }
                } else {
                  // Append arguments
                  if (toolCall.function?.arguments) {
                    currentToolCalls[index].function.arguments +=
                      toolCall.function.arguments;
                  }
                }
              }
            }
          } catch (e) {
            Zotero.debug(`Error parsing SSE line: ${e}`);
          }
        }
      }

      if (callbacks.onComplete) {
        // Await onComplete so async agent loops (tool execution + next model call) are properly tracked
        await callbacks.onComplete(accumulatedContent, currentToolCalls, usage);
      }
    } catch (error) {
      Zotero.debug(`LLM Stream Error: ${error}`);
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
    }
  }
}
