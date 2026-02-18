import { type Tool } from "../services/tools";
import { getDocumentContext, readSnapshotText } from "./document-helpers";

export const searchDocumentTool: Tool = {
  name: "search_document",
  description:
    "Search for a keyword or phrase within the currently open document (PDF or webpage snapshot). Returns matching passages with surrounding context.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The text to search for in the document.",
      },
      maxResults: {
        type: "number",
        description:
          "Maximum number of matching passages to return. Defaults to 5.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute: async ({
    query,
    maxResults = 5,
  }: {
    query: string;
    maxResults?: number;
  }) => {
    if (!query || query.trim().length === 0) {
      return "Please provide a search query.";
    }

    const ctx = await getDocumentContext();

    if (ctx.type === "none") {
      return "No document is currently open.";
    }

    const limit = Math.min(maxResults || 5, 20);

    if (ctx.type === "snapshot") {
      return await searchSnapshot(ctx.snapshotPath!, query, limit);
    }

    return await searchPdf(ctx.pdfApp, query, limit);
  },
};

async function searchSnapshot(
  filePath: string,
  query: string,
  maxResults: number,
): Promise<string> {
  try {
    const text = await readSnapshotText(filePath);
    return searchTextContent(text, query, maxResults, "snapshot");
  } catch (e: any) {
    return `Error searching snapshot: ${e.message}`;
  }
}

async function searchPdf(
  pdfApp: any,
  query: string,
  maxResults: number,
): Promise<string> {
  if (!pdfApp?.pdfDocument) return "No PDF document is loaded.";

  try {
    const totalPages = pdfApp.pdfDocument.numPages;
    const results: { page: number; snippet: string }[] = [];

    for (let i = 1; i <= totalPages && results.length < maxResults; i++) {
      let pageText = "";

      // Try text layer first
      try {
        const pageView = pdfApp.pdfViewer?.getPageView(i - 1);
        if (pageView?.textLayer?.textContentSource) {
          pageText = pageView.textLayer.textContentSource;
        } else if (pageView?.textLayer?.textContent) {
          pageText = pageView.textLayer.textContent;
        }
      } catch (_e) {
        // fall through
      }

      // Try pdfDocument.getPage()
      if (!pageText) {
        try {
          const pdfPage = await pdfApp.pdfDocument.getPage(i);
          const unwrapped = pdfPage?.wrappedJSObject || pdfPage;
          const textContent = await unwrapped.getTextContent();
          const items =
            textContent?.wrappedJSObject?.items || textContent?.items || [];
          pageText = Array.from(items)
            .map((item: any) => item.str || "")
            .join(" ");
        } catch (_e) {
          continue;
        }
      }

      // Search within this page
      const lowerText = pageText.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let searchPos = 0;

      while (searchPos < lowerText.length && results.length < maxResults) {
        const idx = lowerText.indexOf(lowerQuery, searchPos);
        if (idx === -1) break;

        // Extract context around match
        const start = Math.max(0, idx - 100);
        const end = Math.min(pageText.length, idx + query.length + 100);
        const snippet =
          (start > 0 ? "..." : "") +
          pageText.substring(start, end) +
          (end < pageText.length ? "..." : "");

        results.push({ page: i, snippet: snippet.trim() });
        searchPos = idx + query.length;
      }
    }

    if (results.length === 0) {
      return `No matches found for "${query}" in the PDF.`;
    }

    const formatted = results
      .map((r) => `[Page ${r.page}] ${r.snippet}`)
      .join("\n\n");
    return `Found ${results.length} match(es) for "${query}":\n\n${formatted}`;
  } catch (e: any) {
    return `Error searching PDF: ${e.message}`;
  }
}

function searchTextContent(
  text: string,
  query: string,
  maxResults: number,
  _docType: string,
): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const results: string[] = [];
  let searchPos = 0;

  while (searchPos < lowerText.length && results.length < maxResults) {
    const idx = lowerText.indexOf(lowerQuery, searchPos);
    if (idx === -1) break;

    const start = Math.max(0, idx - 120);
    const end = Math.min(text.length, idx + query.length + 120);
    const snippet =
      (start > 0 ? "..." : "") +
      text.substring(start, end) +
      (end < text.length ? "..." : "");

    results.push(snippet.trim());
    searchPos = idx + query.length;
  }

  if (results.length === 0) {
    return `No matches found for "${query}" in the document.`;
  }

  const formatted = results.map((s, i) => `[Match ${i + 1}] ${s}`).join("\n\n");
  return `Found ${results.length} match(es) for "${query}":\n\n${formatted}`;
}
