import { LLMClient } from "./llm";
import { type Tool } from "./tools";

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onToolStart?: (toolName: string, args: Record<string, any>) => void;
  onToolCall?: (toolName: string) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onRequestDebug?: (body: any) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
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

  async run(messages: Message[], callbacks: StreamCallbacks, tools?: Tool[]) {
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

    await this.client.streamChat(
      messages,
      {
        onToken: callbacks.onToken,
        onError: callbacks.onError,
        onRequestDebug: callbacks.onRequestDebug,
        onToolCall: callbacks.onToolCall,
        onComplete: async (accumulatedContent, toolCalls) => {
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
              callbacks.onComplete();
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
