export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
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

// --- Test Tools ---

export const getCurrentTimeTool: Tool = {
  name: "get_current_time",
  description: "Get the current time and date.",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "The timezone to get the time for (e.g. 'America/New_York'). Default is local time.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async ({ timezone }: { timezone?: string }) => {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: "full",
      timeStyle: "long",
    };
    if (timezone) {
      options.timeZone = timezone;
    }
    return new Date().toLocaleString("en-US", options);
  },
};

export const searchZoteroTool: Tool = {
  name: "search_zotero",
  description: "Search for items in the user's Zotero library.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string.",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return. Default is 5.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
    // Basic implementation using Zotero.Search
    const s = new Zotero.Search();
    s.addCondition("quicksearch-titleCreatorYear", "contains", query);
    const ids = await s.search();

    const results = [];
    const max = Math.min(ids.length, limit);

    for (let i = 0; i < max; i++) {
      const item = await Zotero.Items.getAsync(ids[i]);
      if (item) {
        results.push({
          id: item.id,
          title: item.getField("title"),
          creators: item.getCreatorsJSON(),
          date: item.getField("date"),
          type: item.itemType,
        });
      }
    }

    if (results.length === 0) {
      return "No items found matching the query.";
    }

    return JSON.stringify(results, null, 2);
  },
};

export const registry = new ToolRegistry();
registry.register(getCurrentTimeTool);
registry.register(searchZoteroTool);
