import { type Tool } from "../services/tools";

export const getUserAnnotationsTool: Tool = {
  name: "get_user_annotations",
  description:
    "Get all user annotations (highlights, notes, comments) for the currently selected Zotero item's PDF attachment.",
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

      // Find the PDF attachment
      const attachmentIDs = item.getAttachments();
      let pdfAttachment: Zotero.Item | null = null;

      for (const attID of attachmentIDs) {
        const att = await Zotero.Items.getAsync(attID);
        if (att && att.isPDFAttachment?.()) {
          pdfAttachment = att;
          break;
        }
        // Fallback: check content type
        if (att && att.attachmentContentType === "application/pdf") {
          pdfAttachment = att;
          break;
        }
      }

      if (!pdfAttachment) {
        return "No PDF attachment found for this item.";
      }

      // Get annotations on the PDF
      const annotationIDs = pdfAttachment.getAttachments();
      const annotations: any[] = [];

      for (const annID of annotationIDs) {
        const ann = await Zotero.Items.getAsync(annID);
        if (!ann || !ann.isAnnotation?.()) continue;

        const annotation: Record<string, any> = {
          type: ann.annotationType,
          text: ann.annotationText || null,
          comment: ann.annotationComment || null,
          color: ann.annotationColor || null,
          pageLabel: ann.annotationPageLabel || null,
          dateModified: ann.dateModified,
        };

        // Only include non-null fields
        const cleaned = Object.fromEntries(
          Object.entries(annotation).filter(([_, v]) => v !== null),
        );
        annotations.push(cleaned);
      }

      if (annotations.length === 0) {
        return "No annotations found for this document.";
      }

      return JSON.stringify(annotations, null, 2);
    } catch (e: any) {
      return `Error getting annotations: ${e.message}`;
    }
  },
};
