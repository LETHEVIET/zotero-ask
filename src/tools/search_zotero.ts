import { type Tool } from "../services/tools";

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
