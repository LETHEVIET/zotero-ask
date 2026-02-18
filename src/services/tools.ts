export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private disabledTools: Set<string> = new Set();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  /** Returns only enabled tools (for agent use). */
  getTools(): Tool[] {
    return Array.from(this.tools.values()).filter(
      (t) => !this.disabledTools.has(t.name),
    );
  }

  /** Returns all tools regardless of enabled state (for UI). */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  isEnabled(name: string): boolean {
    return !this.disabledTools.has(name);
  }

  setEnabled(name: string, enabled: boolean) {
    if (enabled) {
      this.disabledTools.delete(name);
    } else {
      this.disabledTools.add(name);
    }
  }

  toOpenAITools(): any[] {
    return this.getTools().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true,
      },
    }));
  }
}

export const registry = new ToolRegistry();

// Import tool registrations
import("../tools/index");
