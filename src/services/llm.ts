import "../utils/polyfills";
import { getPref } from "../utils/prefs";
// Import Tool interface (avoiding circular dependency by just using type here if possible, or import)
import { type Tool } from "./tools";

type LLMStreamCallbacks = {
  onToken: (token: string) => void;
  onToolCall?: (toolName: string) => void;
  onComplete?: (fullContent: string, toolCalls: any[]) => void | Promise<void>; // Allow async handlers
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
      const apiKey = (getPref("api_key") as string) || "";
      let baseURL =
        (getPref("api_url") as string) || "https://api.openai.com/v1";
      const model = (getPref("model") as string) || "gpt-4o";

      if (baseURL.endsWith("/")) {
        baseURL = baseURL.slice(0, -1);
      }

      const url = `${baseURL}/chat/completions`;

      const body: any = {
        model: model,
        messages: messages,
        stream: true,
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
        await callbacks.onComplete(accumulatedContent, currentToolCalls);
      }
    } catch (error) {
      Zotero.debug(`LLM Stream Error: ${error}`);
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
    }
  }
}
