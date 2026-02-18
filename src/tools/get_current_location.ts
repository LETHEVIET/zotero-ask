import { type Tool } from "../services/tools";
import { getDocumentContext } from "./document-helpers";

export const getCurrentLocationTool: Tool = {
  name: "get_current_location",
  description:
    "Get information about the currently open document. For PDFs, returns the current page number and total pages. For webpage snapshots, returns the document type.",
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
      return JSON.stringify({
        documentType: "webpage_snapshot",
        message:
          "This is a webpage snapshot. It does not have pages. Use read_page_text (without page param) to read the content, or get_document_outline to see headings.",
      });
    }

    // PDF
    try {
      const currentPage = ctx.pdfApp.pdfViewer?.currentPageNumber ?? null;
      const totalPages = ctx.pdfApp.pdfDocument.numPages ?? null;

      if (currentPage === null) {
        return "Could not determine the current page.";
      }

      return JSON.stringify({
        documentType: "pdf",
        currentPage,
        totalPages,
      });
    } catch (e: any) {
      return `Error getting current location: ${e.message}`;
    }
  },
};
