/**
 * Shared helpers for document tools.
 * Handles both PDF and webpage snapshot detection + content extraction.
 */

export type DocumentType = "pdf" | "snapshot" | "none";

export interface DocumentContext {
  type: DocumentType;
  reader?: any;
  pdfApp?: any;
  snapshotPath?: string;
  snapshotItem?: any;
}

/**
 * Helper to get the active PDF reader instance.
 */
export function getActiveReader(): any | null {
  try {
    const win = Zotero.getMainWindow();
    if (!win) return null;

    // Zotero 7: Try to get reader by the currently selected tab ID
    if (win.Zotero_Tabs && win.Zotero_Tabs.selectedID) {
      const tabID = win.Zotero_Tabs.selectedID;
      const reader = Zotero.Reader.getByTabID(tabID);
      if (reader) {
        return reader;
      }
    }

    // Fallback: If no tab ID matches, we return null rather than guessing purely by index
    // because returning the wrong reader (e.g. index 0) confuses the user.
  } catch (e) {
    Zotero.debug(`Error getting active reader: ${e}`);
  }
  return null;
}

/**
 * Helper to get the PDFViewerApplication from a reader instance.
 */
export function getPDFViewerApplication(reader: any): any | null {
  try {
    return reader?._iframeWindow?.wrappedJSObject?.PDFViewerApplication ?? null;
  } catch (_e) {
    return null;
  }
}

/**
 * Get the selected Zotero item (first selected).
 */
export function getSelectedItem(): any | null {
  try {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (items && items.length > 0) return items[0];
  } catch (_e) {
    // fallback
  }
  return null;
}

/**
 * Find a snapshot (HTML) attachment for the given item.
 */
export async function getSnapshotAttachment(item: any): Promise<any | null> {
  try {
    const attachmentIDs = item.getAttachments();
    for (const attID of attachmentIDs) {
      const att = await Zotero.Items.getAsync(attID);
      if (!att) continue;
      const ct = att.attachmentContentType || "";
      if (ct === "text/html" || ct === "application/xhtml+xml") {
        return att;
      }
    }
  } catch (_e) {
    // fallback
  }
  return null;
}

/**
 * Detect the current document context:
 * - If there's an open PDF reader, return pdf context
 * - If the selected item has a snapshot attachment, return snapshot context
 * - Otherwise return none
 */
export async function getDocumentContext(): Promise<DocumentContext> {
  // Check for open PDF reader first
  const reader = getActiveReader();
  if (reader) {
    const pdfApp = getPDFViewerApplication(reader);
    if (pdfApp?.pdfDocument) {
      return { type: "pdf", reader, pdfApp };
    }
  }

  // Check for snapshot attachment on selected item
  const item = getSelectedItem();
  if (item) {
    const snapshot = await getSnapshotAttachment(item);
    if (snapshot) {
      const filePath = await snapshot.getFilePathAsync();
      if (filePath) {
        return {
          type: "snapshot",
          snapshotPath: filePath,
          snapshotItem: snapshot,
        };
      }
    }
  }

  return { type: "none" };
}

/**
 * Read and parse the HTML snapshot file, returning its text content.
 */
export async function readSnapshotText(filePath: string): Promise<string> {
  const content = (await Zotero.File.getContentsAsync(filePath)) as string;
  // Strip HTML tags, decode entities, and normalize whitespace
  return stripHtml(content);
}

/**
 * Read the raw HTML content of a snapshot file.
 */
export async function readSnapshotHtml(filePath: string): Promise<string> {
  return (await Zotero.File.getContentsAsync(filePath)) as string;
}

/**
 * Extract headings (h1-h6) from HTML content as an outline.
 */
export function extractHeadings(
  html: string,
): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = stripHtml(match[2]).trim();
    if (text) {
      headings.push({ level, text });
    }
  }
  return headings;
}

/**
 * Strip HTML tags and decode common entities.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
