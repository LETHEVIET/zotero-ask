import { type Tool } from "../services/tools";

export const getItemMetadataTool: Tool = {
  name: "get_item_metadata",
  description:
    "Get detailed metadata (title, authors, abstract, date, DOI, tags, etc.) for the currently selected Zotero item.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async () => {
    try {
      const items = Zotero.getActiveZoteroPane().getSelectedItems();
      if (!items || items.length === 0) {
        return "No item is currently selected.";
      }

      const item = items[0];

      const creators = item.getCreatorsJSON().map((c: any) => ({
        type: c.creatorType,
        name: c.firstName ? `${c.firstName} ${c.lastName}` : c.name,
      }));

      const tags = item.getTags().map((t: any) => t.tag);

      const metadata: Record<string, any> = {
        id: item.id,
        title: item.getField("title"),
        itemType: item.itemType,
        creators,
        date: item.getField("date"),
        abstractNote: item.getField("abstractNote") || null,
        DOI: item.getField("DOI") || null,
        url: item.getField("url") || null,
        publicationTitle: item.getField("publicationTitle") || null,
        volume: item.getField("volume") || null,
        issue: item.getField("issue") || null,
        pages: item.getField("pages") || null,
        tags,
      };

      return JSON.stringify(metadata, null, 2);
    } catch (e: any) {
      return `Error getting item metadata: ${e.message}`;
    }
  },
};
