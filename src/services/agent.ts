import { LLMClient } from "./llm";
import { type Tool } from "./tools";
import {
  stripAllThinking,
  shouldSummarize,
  applySummarization,
} from "./summarization";

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onToolStart?: (toolName: string, args: Record<string, any>) => void;
  onToolCall?: (toolName: string) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onRequestDebug?: (body: any) => void;
  onComplete?: (usage?: TokenUsage) => void;
  onError?: (error: Error) => void;
  onSummarize?: () => void;
};

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

export class Agent {
  private client: LLMClient;

  constructor() {
    this.client = new LLMClient();
  }

  // Accumulated token usage across all model calls in this run
  private totalUsage: TokenUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  async run(messages: Message[], callbacks: StreamCallbacks, tools?: Tool[]) {
    // Reset usage for this run
    this.totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    // 1. Prepare Tools for LLM
    const openAiTools =
      tools && tools.length > 0
        ? tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }))
        : undefined;

    // 2. Start ReAct Loop
    // The loop is implicit: we call the model, if it returns tool calls, we execute them and call the model again.
    // If it returns content without tool calls (or with final content), we are done (for that turn).

    await this.modelNode(messages, callbacks, openAiTools, tools);
  }

  private async modelNode(
    messages: Message[],
    callbacks: StreamCallbacks,
    openAiTools: any[] | undefined,
    tools: Tool[] | undefined,
  ) {
    /*
     * MODEL NODE
     * Calls the LLM with current history.
     * Transitions:
     * - If tool_calls: -> toolNode
     * - If no tool_calls: -> End (call callbacks.onComplete)
     */

    // Strip <think> blocks from all messages before sending
    stripAllThinking(messages);

    // Check if summarization is needed
    if (shouldSummarize(messages)) {
      Zotero.debug(
        `[ZoteroAsk] Context exceeds limit — summarizing conversation`,
      );
      if (callbacks.onSummarize) {
        callbacks.onSummarize();
      }
      try {
        const compressed = await applySummarization(messages);
        // Replace messages array contents in-place
        messages.length = 0;
        messages.push(...compressed);
        Zotero.debug(
          `[ZoteroAsk] Summarization complete — ${messages.length} messages remain`,
        );
      } catch (e: any) {
        Zotero.debug(`[ZoteroAsk] Summarization failed: ${e.message}`);
        // Continue with full messages if summarization fails
      }
    }

    await this.client.streamChat(
      messages,
      {
        onToken: callbacks.onToken,
        onError: callbacks.onError,
        onRequestDebug: callbacks.onRequestDebug,
        onToolCall: callbacks.onToolCall,
        onComplete: async (accumulatedContent, toolCalls, usage) => {
          // Accumulate usage from this model call
          if (usage) {
            this.totalUsage.prompt_tokens += usage.prompt_tokens || 0;
            this.totalUsage.completion_tokens += usage.completion_tokens || 0;
            this.totalUsage.total_tokens += usage.total_tokens || 0;
          }

          // Decide next step
          if (toolCalls && toolCalls.length > 0) {
            // Transition to Tool Node

            // First, append the assistant's request to history
            messages.push({
              role: "assistant",
              content: accumulatedContent || null,
              tool_calls: toolCalls,
            });

            await this.toolNode(
              messages,
              toolCalls,
              callbacks,
              openAiTools,
              tools,
            );
          } else {
            // End of chain
            if (callbacks.onComplete) {
              callbacks.onComplete(
                this.totalUsage.total_tokens > 0 ? this.totalUsage : undefined,
              );
            }
          }
        },
      },
      openAiTools,
    );
  }

  private async toolNode(
    messages: Message[],
    toolCalls: any[],
    callbacks: StreamCallbacks,
    openAiTools: any[] | undefined,
    tools: Tool[] | undefined,
  ) {
    /*
     * TOOL NODE
     * Executes the tools requested by the Model.
     * Transitions:
     * - Always -> modelNode
     */

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const argsString = call.function.arguments;
      let result = "";

      const tool = tools?.find((t) => t.name === toolName);
      if (tool) {
        try {
          const args = argsString ? JSON.parse(argsString) : {};
          // Notify UI that tool is starting with its arguments
          if (callbacks.onToolStart) {
            callbacks.onToolStart(toolName, args);
          }
          result = await tool.execute(args);
        } catch (e: any) {
          result = `Error executing tool: ${e.message}`;
        }
      } else {
        result = `Error: Tool ${toolName} not found.`;
      }

      if (callbacks.onToolResult) {
        callbacks.onToolResult(toolName, result);
      }

      // Append result to history
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }

    // Loop back to Model
    await this.modelNode(messages, callbacks, openAiTools, tools);
  }
}

export const agent = new Agent();
