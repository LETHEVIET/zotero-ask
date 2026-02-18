import { type Tool } from "../services/tools";
import {
  getDocumentContext,
  readSnapshotText,
  readSnapshotHtml,
  extractHeadings,
} from "./document-helpers";

export const readPageTextTool: Tool = {
  name: "read_page_text",
  description:
    "Extract text content from the currently open document. For PDFs: provide a page number (1-indexed) and optional endPage for a range. For webpage snapshots: returns the full text content, optionally filtered to a specific section by heading name.",
  parameters: {
    type: "object",
    properties: {
      page: {
        type: "number",
        description:
          "The page number to read (1-indexed). Required for PDFs, ignored for snapshots.",
      },
      endPage: {
        type: "number",
        description:
          "Optional end page number (1-indexed, inclusive) to read a range. PDF only.",
      },
      section: {
        type: "string",
        description:
          "Optional heading name to extract a specific section from a webpage snapshot. If omitted, returns the full text.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async ({
    page,
    endPage,
    section,
  }: {
    page?: number;
    endPage?: number;
    section?: string;
  }) => {
    const ctx = await getDocumentContext();

    if (ctx.type === "none") {
      return "No document is currently open.";
    }

    if (ctx.type === "snapshot") {
      return await readSnapshotContent(ctx.snapshotPath!, section);
    }

    // PDF path
    if (!page) {
      return "For PDF documents, the 'page' parameter is required.";
    }
    return await readPdfPageText(ctx.pdfApp, page, endPage);
  },
};

async function readSnapshotContent(
  filePath: string,
  section?: string,
): Promise<string> {
  try {
    if (section) {
      // Extract text from a specific section (heading to next heading of same/higher level)
      const html = await readSnapshotHtml(filePath);
      const sectionText = extractSection(html, section);
      if (sectionText) {
        const trimmed =
          sectionText.length > 5000
            ? sectionText.substring(0, 5000) + "\n...(truncated)"
            : sectionText;
        return `--- Section: ${section} ---\n${trimmed}`;
      }
      return `Section "${section}" not found. Use get_document_outline to see available headings.`;
    }

    // Full text
    const text = await readSnapshotText(filePath);
    const trimmed =
      text.length > 8000
        ? text.substring(0, 8000) +
          "\n...(truncated, use 'section' parameter to read specific parts)"
        : text;
    return `--- Webpage Content ---\n${trimmed}`;
  } catch (e: any) {
    return `Error reading snapshot: ${e.message}`;
  }
}

/**
 * Extract text from a specific section of HTML content.
 * Finds the heading matching `sectionName` and extracts content until the next heading of same or higher level.
 */
function extractSection(html: string, sectionName: string): string | null {
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: {
    level: number;
    text: string;
    index: number;
    endIndex: number;
  }[] = [];

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      text: match[2].replace(/<[^>]+>/g, "").trim(),
      index: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Find matching heading (case-insensitive partial match)
  const target = headings.find((h) =>
    h.text.toLowerCase().includes(sectionName.toLowerCase()),
  );
  if (!target) return null;

  // Find the next heading of same or higher level
  const targetIdx = headings.indexOf(target);
  let endIdx = html.length;
  for (let i = targetIdx + 1; i < headings.length; i++) {
    if (headings[i].level <= target.level) {
      endIdx = headings[i].index;
      break;
    }
  }

  const sectionHtml = html.substring(target.endIndex, endIdx);
  // Strip tags and clean up
  return sectionHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function readPdfPageText(
  pdfApp: any,
  page: number,
  endPage?: number,
): Promise<string> {
  if (!pdfApp?.pdfDocument) return "No PDF document is loaded.";

  const totalPages = pdfApp.pdfDocument.numPages;
  const startPage = page;
  const lastPage = endPage ?? page;

  if (startPage < 1 || startPage > totalPages) {
    return `Invalid page number ${startPage}. Document has ${totalPages} pages.`;
  }
  if (lastPage < startPage || lastPage > totalPages) {
    return `Invalid end page ${lastPage}. Must be between ${startPage} and ${totalPages}.`;
  }

  const maxPages = 10;
  const effectiveEnd = Math.min(lastPage, startPage + maxPages - 1);

  try {
    const parts: string[] = [];

    for (let i = startPage; i <= effectiveEnd; i++) {
      let pageText = "";

      // Strategy 1: Use the rendered text layer
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

      // Strategy 2: Use pdfDocument.getPage() with Xray unwrapping
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
          pageText = "(Could not extract text from this page)";
        }
      }

      parts.push(`--- Page ${i} ---\n${pageText}`);
    }

    if (effectiveEnd < lastPage) {
      parts.push(
        `\n(Showing pages ${startPage}-${effectiveEnd} of requested ${startPage}-${lastPage}. Use smaller ranges to read more.)`,
      );
    }

    return parts.join("\n\n");
  } catch (e: any) {
    return `Error reading page text: ${e.message}`;
  }
}
