import { getLocaleID } from "../utils/locale";

// Inline Lucide Icons to avoid runtime module issues in Zotero
const ICONS = {
  ArrowUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
  User: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  Sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
};

export class ChatPanel {
  static register() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "zotero-ask-chat",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: getLocaleID("chat-panel-header" as any),
        icon: "chrome://zotero/skin/16/universal/speech-bubble.svg",
      },
      sidenav: {
        l10nID: getLocaleID("chat-panel-sidenav" as any),
        icon: "chrome://zotero/skin/20/universal/speech-bubble.svg",
      },
      onRender: ({ body, item }) => {
        // Clear existing content
        body.innerHTML = "";

        // Helper to Create SVG directly
        const createSvgIcon = (
          svgString: string,
          size = 16,
          color = "currentColor",
        ) => {
          const temp = body.ownerDocument!.createElement("div");
          temp.innerHTML = svgString;
          const svg = temp.firstElementChild as HTMLElement;
          if (svg) {
            svg.setAttribute("width", size.toString());
            svg.setAttribute("height", size.toString());
            // We can set color if needed, but 'currentColor' usually inherits
            if (color !== "currentColor") {
              svg.style.stroke = color;
            }
          }
          return svg;
        };

        // Main container
        const container = body.ownerDocument!.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.height = "100%";
        container.style.fontFamily =
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

        // Messages area
        const messagesArea = body.ownerDocument!.createElement("div");
        messagesArea.id = "zotero-ask-messages";
        messagesArea.style.flexGrow = "1";
        messagesArea.style.overflowY = "auto";
        messagesArea.style.padding = "10px";
        messagesArea.style.display = "flex";
        messagesArea.style.flexDirection = "column";
        messagesArea.style.gap = "12px";
        messagesArea.style.minHeight = "200px";

        const inputContainer = body.ownerDocument!.createElement("div");
        inputContainer.style.padding = "10px";
        inputContainer.style.borderTop =
          "1px solid var(--material-divider, #e1e4e8)";

        // Selection Context Badge Container
        const selectionContainer = body.ownerDocument!.createElement("div");
        selectionContainer.style.marginBottom = "8px";
        selectionContainer.style.display = "none"; // Hidden by default
        selectionContainer.style.alignItems = "center";
        selectionContainer.style.justifyContent = "space-between";
        selectionContainer.style.padding = "4px 8px";
        selectionContainer.style.backgroundColor =
          "var(--material-background, #fff)";
        selectionContainer.style.border =
          "1px solid var(--material-divider, #d1d5da)";
        selectionContainer.style.borderRadius = "6px";
        selectionContainer.style.fontSize = "12px";
        selectionContainer.style.color = "var(--material-text-color, #24292f)";
        selectionContainer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

        const selectionTextSpan = body.ownerDocument!.createElement("span");
        selectionTextSpan.style.whiteSpace = "nowrap";
        selectionTextSpan.style.overflow = "hidden";
        selectionTextSpan.style.textOverflow = "ellipsis";
        selectionTextSpan.style.maxWidth = "200px";

        const closeSelectionBtn = body.ownerDocument!.createElement("div");
        closeSelectionBtn.textContent = "×"; // &times; entity can cause XML parse errors in Zotero
        closeSelectionBtn.style.cursor = "pointer";
        closeSelectionBtn.style.fontWeight = "bold";
        closeSelectionBtn.style.marginLeft = "8px";
        closeSelectionBtn.style.color = "var(--material-text-medium, #6e7781)";

        closeSelectionBtn.onclick = () => {
          selectionContainer.style.display = "none";
          selectionTextSpan.textContent = "";
          selectionTextSpan.dataset.fullText = "";
        };

        selectionContainer.appendChild(selectionTextSpan);
        selectionContainer.appendChild(closeSelectionBtn);
        inputContainer.appendChild(selectionContainer);

        // Reader Selection Listener
        const readerSelectionHandler = (event: any) => {
          // Check if the event is from the active reader/viewer
          // For simplicity, we just take the text if available
          const text = event.selection?.toString() || event.annotation?.text;
          if (text && text.length > 0) {
            selectionTextSpan.textContent = `Selected: "${text}"`;
            selectionTextSpan.dataset.fullText = text;
            selectionContainer.style.display = "flex";
            // Auto-focus input? Maybe not.
          }
        };

        // We need to register this globally or manage lifecycle.
        // For this prototype, we'll try to hook into Zotero.Reader events.
        // NOTE: Zotero.Reader.registerEventListener might not be available in all versions or might behave differently.
        // Using a safer approach with a try-catch or check.
        try {
          // @ts-ignore
          Zotero.Reader.registerEventListener(
            "renderTextSelectionPopup",
            (event) => {
              // We need to pass this to our UI.
              // Since we are inside onRender, we have access to OUR dom.
              // But onRender is called only once when the view is created.
              // The event is global. We need to check if *this* view is still valid.
              if (!body.isConnected) return; // View usage check

              // Extract text from the event parameters
              // The event structure for 'renderTextSelectionPopup' usually has { reader, doc, params, append }
              // params.annotation.text might be what we want if it's an annotation creation,
              // OR simply we can try to get selection from the reader instance.

              const params = (event as any).params;
              const selectedText =
                params?.selection?.toString() || params?.annotation?.text || "";

              if (selectedText) {
                selectionTextSpan.textContent = `Selected: "${selectedText}"`;
                selectionTextSpan.dataset.fullText = selectedText;
                selectionContainer.style.display = "flex";
              }
            },
            addon.data.config.addonID,
          );
        } catch (e) {
          // Ignore registration errors
        }

        // Input Wrapper
        const inputWrapper = body.ownerDocument!.createElement("div");
        inputWrapper.style.display = "flex";
        inputWrapper.style.alignItems = "flex-end";
        inputWrapper.style.backgroundColor = "var(--material-background, #fff)";
        inputWrapper.style.border =
          "1px solid var(--material-divider, #d1d5da)";
        inputWrapper.style.borderRadius = "6px";
        inputWrapper.style.padding = "8px";
        inputWrapper.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

        // Textarea
        const textarea = body.ownerDocument!.createElement("textarea");
        textarea.style.flexGrow = "1";
        textarea.style.border = "none";
        textarea.style.resize = "none";
        textarea.style.outline = "none";
        textarea.style.backgroundColor = "transparent";
        textarea.style.fontSize = "13px";
        textarea.style.lineHeight = "20px";
        textarea.style.maxHeight = "120px";
        textarea.style.fontFamily = "inherit";
        textarea.placeholder = "Ask about this document...";
        textarea.rows = 1;

        // Auto-resize textarea
        textarea.addEventListener("input", () => {
          textarea.style.height = "auto";
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
        });

        // Send Button
        const sendBtn = body.ownerDocument!.createElement("button");
        // sendBtn.innerText = "Send";
        sendBtn.style.marginLeft = "8px";
        sendBtn.style.padding = "6px";
        sendBtn.style.backgroundColor = "#2da44e"; // GitHub Green
        sendBtn.style.color = "#fff";
        sendBtn.style.border = "1px solid rgba(27,31,35,0.15)";
        sendBtn.style.borderRadius = "6px";
        sendBtn.style.cursor = "pointer";
        sendBtn.style.alignSelf = "center";
        sendBtn.style.display = "flex";
        sendBtn.style.alignItems = "center";
        sendBtn.style.justifyContent = "center";

        // Icon for Send Button
        const sendIcon = createSvgIcon(ICONS.ArrowUp, 16, "#fff");
        sendBtn.appendChild(sendIcon);

        // Send Button Hover Effect
        sendBtn.onmouseover = () => {
          sendBtn.style.backgroundColor = "#2c974b";
        };
        sendBtn.onmouseout = () => {
          sendBtn.style.backgroundColor = "#2da44e";
        };

        const appendMessage = (text: string, sender: "You" | "AI") => {
          const rowDiv = body.ownerDocument!.createElement("div");
          rowDiv.style.display = "flex";
          rowDiv.style.justifyContent =
            sender === "You" ? "flex-end" : "flex-start";
          rowDiv.style.alignItems = "flex-start";
          rowDiv.style.gap = "8px";

          // Icon
          const iconDiv = body.ownerDocument!.createElement("div");
          iconDiv.style.minWidth = "24px";
          iconDiv.style.height = "24px";
          iconDiv.style.borderRadius = "50%";
          iconDiv.style.display = "flex";
          iconDiv.style.alignItems = "center";
          iconDiv.style.justifyContent = "center";
          iconDiv.style.backgroundColor =
            sender === "You" ? "#0969da" : "#6e7781";
          iconDiv.style.color = "#fff";

          const icon =
            sender === "You"
              ? createSvgIcon(ICONS.User, 14, "#fff")
              : createSvgIcon(ICONS.Sparkles, 14, "#fff");
          iconDiv.appendChild(icon);

          const msgDiv = body.ownerDocument!.createElement("div");
          msgDiv.style.padding = "8px 12px";
          msgDiv.style.borderRadius = "12px";
          msgDiv.style.maxWidth = "85%";
          msgDiv.style.fontSize = "13px";
          msgDiv.style.lineHeight = "1.4";
          msgDiv.style.wordBreak = "break-word";
          msgDiv.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";

          // Render Main Text
          const textSpan = body.ownerDocument!.createElement("div");
          textSpan.textContent = text;
          msgDiv.appendChild(textSpan);

          // Render Context if any (and only for user messages if we want to show what was sent)
          // For now, let's assume 'text' passed to appendMessage ALREADY includes the context or we handle it separately.
          // Better: modify sendMessage to construct the full message.

          if (sender === "You") {
            msgDiv.style.backgroundColor = "#0969da"; // GitHub Blue
            msgDiv.style.color = "#ffffff";
            msgDiv.style.borderBottomRightRadius = "2px";

            rowDiv.appendChild(msgDiv);
            rowDiv.appendChild(iconDiv); // Icon on right for user
          } else {
            msgDiv.style.backgroundColor = "var(--material-side-nav, #f6f8fa)";
            msgDiv.style.color = "var(--material-on-background, #24292f)";
            msgDiv.style.border = "1px solid var(--material-divider, #d0d7de)";
            msgDiv.style.borderBottomLeftRadius = "2px";

            rowDiv.appendChild(iconDiv); // Icon on left for AI
            rowDiv.appendChild(msgDiv);
          }

          messagesArea.appendChild(rowDiv);
          messagesArea.scrollTop = messagesArea.scrollHeight;
        };

        const sendMessage = () => {
          const value = textarea.value.trim();
          if (!value) return;

          let fullMessage = value;
          const context = selectionTextSpan.dataset.fullText;
          if (context && selectionContainer.style.display !== "none") {
            fullMessage = `Context: """${context}"""\n\nQuestion: ${value}`;
            // Clear selection after sending
            selectionContainer.style.display = "none";
            selectionTextSpan.textContent = "";
            selectionTextSpan.dataset.fullText = "";
          }

          appendMessage(fullMessage, "You");
          textarea.value = "";
          textarea.style.height = "auto";

          // Mock AI response
          setTimeout(() => {
            const title = item.getField("title");
            appendMessage(
              `I am analyzing "${title}"... (Mock Response)\n\nThis is a sample response in the style of GitHub Copilot using Lucide icons.`,
              "AI",
            );
          }, 800);
        };

        sendBtn.onclick = sendMessage;

        // Allow Enter key to send (Shift+Enter for newline)
        textarea.onkeydown = (e: any) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        };

        inputWrapper.appendChild(textarea);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(inputWrapper);

        container.appendChild(messagesArea);
        container.appendChild(inputContainer);

        body.appendChild(container);
      },
    });
  }
}
