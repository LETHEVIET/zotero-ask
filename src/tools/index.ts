import { registry } from "../services/tools";
import { getCurrentTimeTool } from "./get_current_time";
import { searchZoteroTool } from "./search_zotero";
import { getDocumentOutlineTool } from "./get_document_outline";
import { getCurrentLocationTool } from "./get_current_location";
import { readPageTextTool } from "./read_page_text";
import { getItemMetadataTool } from "./get_item_metadata";
import { getUserAnnotationsTool } from "./get_user_annotations";
import { searchDocumentTool } from "./search_document";

// Register all tools
registry.register(getCurrentTimeTool);
registry.register(searchZoteroTool);
registry.register(getDocumentOutlineTool);
registry.register(getCurrentLocationTool);
registry.register(readPageTextTool);
registry.register(getItemMetadataTool);
registry.register(getUserAnnotationsTool);
registry.register(searchDocumentTool);
