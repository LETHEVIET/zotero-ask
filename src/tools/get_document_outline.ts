import { type Tool } from "../services/tools";
import {
  getDocumentContext,
  extractHeadings,
  readSnapshotHtml,
} from "./document-helpers";

export { getActiveReader, getPDFViewerApplication } from "./document-helpers";

export const getDocumentOutlineTool: Tool = {
  name: "get_document_outline",
  description:
    "Get the outline/structure of the currently open document. For PDFs, returns the Table of Contents with page numbers. For webpage snapshots, returns the heading hierarchy (h1-h6).",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async () => {
    const ctx = await getDocumentContext();

    if (ctx.type === "none") {
      return "No document is currently open.";
    }

    if (ctx.type === "snapshot") {
      return await getSnapshotOutline(ctx.snapshotPath!);
    }

    // PDF path
    return await getPdfOutline(ctx.pdfApp);
  },
};

async function getSnapshotOutline(filePath: string): Promise<string> {
  try {
    const html = await readSnapshotHtml(filePath);
    const headings = extractHeadings(html);

    if (headings.length === 0) {
      return "This webpage has no headings.";
    }

    const minLevel = Math.min(...headings.map((h) => h.level));
    const lines = headings.map(
      (h) => `${"  ".repeat(h.level - minLevel)}${h.text}`,
    );
    return `Webpage Outline (${headings.length} headings):\n${lines.join("\n")}`;
  } catch (e: any) {
    return `Error reading snapshot outline: ${e.message}`;
  }
}

async function getPdfOutline(pdfApp: any): Promise<string> {
  if (!pdfApp?.pdfDocument) return "No PDF document is loaded.";

  try {
    const outline = await pdfApp.pdfDocument.getOutline();
    if (!outline || outline.length === 0) {
      return "This document has no outline/table of contents.";
    }

    const pdfDoc = pdfApp.pdfDocument;

    const resolvePageNumber = async (item: any): Promise<number | null> => {
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await pdfDoc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest[0]) {
          const pageIndex = await pdfDoc.getPageIndex(dest[0]);
          return pageIndex + 1;
        }
      } catch (_e) {
        // Some destinations can't be resolved
      }
      return null;
    };

    const walkOutline = async (
      items: any[],
      depth = 0,
    ): Promise<{ title: string; page: number | null; depth: number }[]> => {
      const result: { title: string; page: number | null; depth: number }[] =
        [];
      for (const item of items) {
        const page = await resolvePageNumber(item);
        result.push({ title: item.title, page, depth });
        if (item.items && item.items.length > 0) {
          result.push(...(await walkOutline(item.items, depth + 1)));
        }
      }
      return result;
    };

    const entries = await walkOutline(outline);
    const lines = entries.map(
      (e) =>
        `${"  ".repeat(e.depth)}${e.title}${e.page !== null ? ` (page ${e.page})` : ""}`,
    );
    return lines.join("\n");
  } catch (e: any) {
    return `Error reading outline: ${e.message}`;
  }
}
