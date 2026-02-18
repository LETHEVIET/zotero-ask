import { type Tool } from "../services/tools";
import { getActiveReader } from "./document-helpers";

export { getActiveReader, getPDFViewerApplication } from "./document-helpers";

export const getDocumentOutlineTool: Tool = {
  name: "get_document_outline",
  description:
    "Get the outline/structure of the currently open document. For PDFs, returns the Table of Contents with page numbers. For EPUBs, returns the navigation TOC. For webpage snapshots, returns the heading hierarchy.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async () => {
    const reader = getActiveReader();
    if (!reader) return "No document is currently open in the reader.";

    try {
      await (reader as any)._initPromise;

      const type = (reader as any)._type || "unknown"; // 'pdf', 'epub', 'snapshot'
      const internalReader = (reader as any)._internalReader;
      if (!internalReader) return "Internal reader not ready.";

      // The outline is lazily loaded — trigger it by switching sidebar view
      internalReader.setSidebarView("outline");

      // Wait for outline to populate in the reader state (max 5s)
      let maxWait = 50;
      while (!internalReader._state?.outline && maxWait-- > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }

      const rawOutline = internalReader._state?.outline;
      if (!rawOutline) {
        return "This document has no outline/table of contents.";
      }

      // Clone out of the content compartment via JSON round-trip
      const outline = JSON.parse(JSON.stringify(rawOutline)) as any[];

      if (!outline || outline.length === 0) {
        return "This document has no outline/table of contents.";
      }

      function formatOutline(items: any[], depth = 0): string[] {
        const lines: string[] = [];
        for (const item of items) {
          // PDF:      item.location.position.pageIndex
          // EPUB:     item.location.href
          // Snapshot: item.location.position (CSS selector)
          let locStr = "";
          if (item.location?.position?.pageIndex !== undefined) {
            locStr = ` (page ${item.location.position.pageIndex + 1})`;
          } else if (item.location?.href) {
            locStr = ` [${item.location.href}]`;
          }
          lines.push("  ".repeat(depth) + item.title + locStr);
          if (item.items && item.items.length > 0) {
            lines.push(...formatOutline(item.items, depth + 1));
          }
        }
        return lines;
      }

      const header = `[${type.toUpperCase()}] Document Outline (${outline.length} top-level entries):\n`;
      return header + formatOutline(outline).join("\n");
    } catch (e: any) {
      Zotero.debug(`[ZoteroAsk] Outline error: ${e.message}\n${e.stack}`);
      return `Error reading outline: ${e.message}`;
    }
  },
};
