import { marked } from "marked";
import { getLocaleID, getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

// Inline Lucide Icons
const ICONS = {
  ArrowUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
  Settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  Trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  Refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
  Copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  Check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  Bug: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`,
};

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant built into Zotero. You help users understand their documents, summarize content, and answer research-related questions.";

// Manage active UI instances
const activeChatUIs: { [key: string]: ChatUI } = {};

export function registerChatPanel() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "zotero-ask-chat",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("chat-panel-header" as any),
      icon: "chrome://zoteroask/content/icons/icon-16.svg",
    },
    sidenav: {
      l10nID: getLocaleID("chat-panel-sidenav" as any),
      icon: "chrome://zoteroask/content/icons/icon-20.svg",
    },
    sectionButtons: [
      {
        type: "clear",
        icon: "chrome://zoteroask/content/icons/icon-trash.svg",
        l10nID: getLocaleID("chat-clear-title" as any) || "Clear Chat",
        onClick: () => {
          const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
          if (!item) return;
          const chatUI = Object.values(activeChatUIs).find(
            (ui) => ui.currentItem?.id === item.id,
          );
          chatUI?.clearChat();
        },
      },
      {
        type: "debug",
        icon: "chrome://zoteroask/content/icons/icon-bug.svg",
        l10nID: getLocaleID("chat-debug-title" as any) || "Debug",
        onClick: () => {
          const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
          if (!item) return;
          const chatUI = Object.values(activeChatUIs).find(
            (ui) => ui.currentItem?.id === item.id,
          );
          chatUI?.showDebugModal();
        },
      },
      {
        type: "tools",
        icon: "chrome://zoteroask/content/icons/icon-tools.svg",
        l10nID: getLocaleID("chat-tools-title" as any) || "Tools",
        onClick: () => {
          const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
          if (!item) return;
          const chatUI = Object.values(activeChatUIs).find(
            (ui) => ui.currentItem?.id === item.id,
          );
          chatUI?.showToolsModal();
        },
      },
      {
        type: "settings",
        icon: "chrome://zoteroask/content/icons/icon-settings.svg",
        l10nID: getLocaleID("chat-settings-title" as any) || "Settings",
        onClick: () => {
          openSettingsWindow();
        },
      },
    ],
    onInit: ({ body }) => {
      const paneUID = Zotero.Utilities.randomString(8);
      body.dataset.paneUid = paneUID;
    },
    onRender: ({ body, item }) => {
      const paneUID = body.dataset.paneUid;
      if (!paneUID) return;

      let chatUI = activeChatUIs[paneUID];
      if (!chatUI) {
        chatUI = new ChatUI(body);
        activeChatUIs[paneUID] = chatUI;
      }

      chatUI.update(item);
    },
    onDestroy: ({ body }) => {
      const paneUID = body.dataset.paneUid;
      if (paneUID && activeChatUIs[paneUID]) {
        activeChatUIs[paneUID].destroy();
        delete activeChatUIs[paneUID];
      }
    },
  });
}

function openSettingsWindow() {
  const win = Zotero.getMainWindow();
  if (win) {
    win.openDialog(
      "chrome://zoteroask/content/settings.xhtml",
      "zoteroask-settings",
      "chrome,centerscreen,resizable=yes",
      Zotero,
    );
  }
}

class ChatUI {
  private history: {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    id: string;
    tool_calls?: any[];
    tool_call_id?: string;
  }[] = [];
  private lastDebugPayload: any = null;
  public currentItem: Zotero.Item | null = null;
  private messagesArea!: HTMLElement;
  private selectionContainer!: HTMLElement;
  private selectionTextSpan!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  constructor(private container: HTMLElement) {
    this.renderInitialUI();
  }

  update(item: Zotero.Item) {
    // If item changes, maybe clear chat? For now, we just update context.
    // If we want to clear chat on item change:
    if (this.currentItem && this.currentItem.id !== item.id) {
      this.clearChat();
    }
    this.currentItem = item;
  }

  destroy() {
    // Cleanup listeners if any (e.g. reader listeners)
    // Zotero.Reader.unregisterEventListener if we stored it?
    // The original code tried to register it every render, which might rely on it being idempotent or throwing.
  }

  clearChat() {
    this.history = [];
    if (this.messagesArea) this.messagesArea.innerHTML = "";
  }

  private renderInitialUI() {
    this.container.innerHTML = ""; // Clear root

    // Read Preferences
    const fontSizePref = getPref("font_size") as string;
    let fontSize = "13px";
    if (fontSizePref === "small") fontSize = "11px";
    if (fontSizePref === "large") fontSize = "15px";

    // Inject Markdown CSS
    const style = this.container.ownerDocument!.createElement("style");
    style.textContent = `
      .markdown-body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: ${fontSize};
        line-height: 1.5;
        word-wrap: break-word;
      }
      .markdown-body p { margin-bottom: 10px; margin-top: 0; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
      .markdown-body h1 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      .markdown-body h2 { font-size: 1.3em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      .markdown-body code { padding: 0.2em 0.4em; margin: 0; font-size: 85%; background-color: rgba(27,31,35,0.05); border-radius: 3px; font-family: SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace; }
      .markdown-body pre { padding: 10px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #f6f8fa; border-radius: 3px; }
      .markdown-body pre code { display: inline; padding: 0; margin: 0; overflow: visible; line-height: inherit; word-wrap: normal; background-color: initial; border: 0; }
      .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 10px; }
      .markdown-body blockquote { padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; margin: 0 0 16px 0; }
      .markdown-body a { color: #0366d6; text-decoration: none; }
      .markdown-body a:hover { text-decoration: underline; }
    `;
    this.container.appendChild(style);

    // Main layout
    const mainDiv = this.container.ownerDocument!.createElement("div");
    mainDiv.style.display = "flex";
    mainDiv.style.flexDirection = "column";
    mainDiv.style.height = "100%";
    mainDiv.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    mainDiv.style.position = "relative";

    // Messages Area
    this.messagesArea = this.container.ownerDocument!.createElement("div");
    this.messagesArea.id = "zotero-ask-messages";
    this.messagesArea.style.flexGrow = "1";
    this.messagesArea.style.overflowY = "auto";
    this.messagesArea.style.padding = "10px";
    this.messagesArea.style.display = "flex";
    this.messagesArea.style.flexDirection = "column";
    this.messagesArea.style.gap = "12px";
    this.messagesArea.style.minHeight = "200px";
    mainDiv.appendChild(this.messagesArea);

    // Input Area
    this.renderInputArea(mainDiv);

    this.container.appendChild(mainDiv);

    // Reader Selection Listener
    this.registerReaderListener();
  }

  private renderInputArea(parent: HTMLElement) {
    const inputContainer = this.container.ownerDocument!.createElement("div");
    inputContainer.style.padding = "10px";
    inputContainer.style.borderTop =
      "1px solid var(--material-divider, #e1e4e8)";

    // Selection Context
    this.selectionContainer =
      this.container.ownerDocument!.createElement("div");
    this.selectionContainer.style.marginBottom = "8px";
    this.selectionContainer.style.display = "none";
    this.selectionContainer.style.alignItems = "center";
    this.selectionContainer.style.justifyContent = "space-between";
    this.selectionContainer.style.padding = "4px 8px";
    this.selectionContainer.style.backgroundColor =
      "var(--material-background, #fff)";
    this.selectionContainer.style.border =
      "1px solid var(--material-divider, #d1d5da)";
    this.selectionContainer.style.borderRadius = "6px";
    this.selectionContainer.style.fontSize = "12px";
    this.selectionContainer.style.color = "var(--material-text-color, #24292f)";
    this.selectionContainer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

    this.selectionTextSpan =
      this.container.ownerDocument!.createElement("span");
    this.selectionTextSpan.style.whiteSpace = "nowrap";
    this.selectionTextSpan.style.overflow = "hidden";
    this.selectionTextSpan.style.textOverflow = "ellipsis";
    this.selectionTextSpan.style.maxWidth = "200px";

    const closeSelectionBtn =
      this.container.ownerDocument!.createElement("div");
    closeSelectionBtn.textContent = "×";
    closeSelectionBtn.style.cursor = "pointer";
    closeSelectionBtn.style.fontWeight = "bold";
    closeSelectionBtn.style.marginLeft = "8px";
    closeSelectionBtn.style.color = "var(--material-text-medium, #6e7781)";
    closeSelectionBtn.onclick = () => {
      this.selectionContainer.style.display = "none";
      this.selectionTextSpan.textContent = "";
      this.selectionTextSpan.dataset.fullText = "";
    };

    this.selectionContainer.appendChild(this.selectionTextSpan);
    this.selectionContainer.appendChild(closeSelectionBtn);
    inputContainer.appendChild(this.selectionContainer);

    // Input Wrapper
    const inputWrapper = this.container.ownerDocument!.createElement("div");
    inputWrapper.style.display = "flex";
    inputWrapper.style.alignItems = "flex-end";
    inputWrapper.style.backgroundColor = "var(--material-background, #fff)";
    inputWrapper.style.border = "1px solid var(--material-divider, #d1d5da)";
    inputWrapper.style.borderRadius = "6px";
    inputWrapper.style.padding = "8px";
    inputWrapper.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";

    this.textarea = this.container.ownerDocument!.createElement("textarea");
    this.textarea.style.flexGrow = "1";
    this.textarea.style.border = "none";
    this.textarea.style.resize = "none";
    this.textarea.style.outline = "none";
    this.textarea.style.backgroundColor = "transparent";
    this.textarea.style.fontSize = "13px";
    this.textarea.style.lineHeight = "20px";
    this.textarea.style.maxHeight = "120px";
    this.textarea.style.fontFamily = "inherit";
    this.textarea.placeholder = "Ask about this document...";
    this.textarea.rows = 1;

    this.textarea.addEventListener("input", () => {
      this.textarea.style.height = "auto";
      this.textarea.style.height =
        Math.min(this.textarea.scrollHeight, 120) + "px";
    });
    this.textarea.onkeydown = (e: any) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    };

    this.sendBtn = this.container.ownerDocument!.createElement("button");
    this.sendBtn.style.marginLeft = "8px";
    this.sendBtn.style.padding = "6px";
    this.sendBtn.style.backgroundColor = "#2da44e";
    this.sendBtn.style.color = "#fff";
    this.sendBtn.style.border = "1px solid rgba(27,31,35,0.15)";
    this.sendBtn.style.borderRadius = "6px";
    this.sendBtn.style.cursor = "pointer";
    this.sendBtn.style.alignSelf = "center";
    this.sendBtn.style.display = "flex";
    this.sendBtn.style.alignItems = "center";
    this.sendBtn.style.justifyContent = "center";

    const sendIcon = this.createSvgIcon(ICONS.ArrowUp, 16, "#fff");
    this.sendBtn.appendChild(sendIcon);

    this.sendBtn.onmouseover = () => {
      this.sendBtn.style.backgroundColor = "#2c974b";
    };
    this.sendBtn.onmouseout = () => {
      this.sendBtn.style.backgroundColor = "#2da44e";
    };
    this.sendBtn.onclick = () => this.sendMessage();

    inputWrapper.appendChild(this.textarea);
    inputWrapper.appendChild(this.sendBtn);
    inputContainer.appendChild(inputWrapper);
    parent.appendChild(inputContainer);
  }

  private registerReaderListener() {
    try {
      Zotero.Reader.registerEventListener(
        "renderTextSelectionPopup",
        (event) => {
          if (!this.container.isConnected) return;

          const params = (event as any).params;
          const selectedText =
            params?.selection?.toString() || params?.annotation?.text || "";

          if (selectedText) {
            this.selectionTextSpan.textContent = `Selected: "${selectedText}"`;
            this.selectionTextSpan.dataset.fullText = selectedText;
            this.selectionContainer.style.display = "flex";
          }
        },
        addon.data.config.addonID,
      );
    } catch (e) {
      // Ignore
    }
  }

  private async sendMessage() {
    const value = this.textarea.value.trim();
    if (!value) return;

    this.textarea.disabled = true;
    this.sendBtn.disabled = true;
    this.sendBtn.style.opacity = "0.6";
    this.sendBtn.style.cursor = "not-allowed";

    let fullMessage = value;
    const context = this.selectionTextSpan.dataset.fullText;
    if (context && this.selectionContainer.style.display !== "none") {
      fullMessage = `Context: """${context}"""\n\nQuestion: ${value}`;
      this.selectionContainer.style.display = "none";
      this.selectionTextSpan.textContent = "";
      this.selectionTextSpan.dataset.fullText = "";
    }

    const userMsgId = this.generateId();
    this.appendMessage(fullMessage, "You", userMsgId);
    this.history.push({ role: "user", content: fullMessage, id: userMsgId });

    this.textarea.value = "";
    this.textarea.style.height = "auto";

    const aiMsgId = this.generateId();
    const updateAiMessage = this.appendMessage(
      "Thinking...",
      "AI",
      aiMsgId,
      true,
      [],
    );
    let aiResponseText = "";
    type ReasoningStep =
      | { type: "model"; status: "thinking" | "done"; content: string }
      | {
          type: "tool";
          status: "running" | "done";
          name: string;
          args?: any;
          result?: string;
        };
    const reasoningSteps: ReasoningStep[] = [];
    // Start with a model thinking step
    reasoningSteps.push({ type: "model", status: "thinking", content: "" });

    try {
      const { agent } = await import("../services/agent");

      const systemPrompt =
        (getPref("system_prompt") as string) || DEFAULT_SYSTEM_PROMPT;

      // Prepare History
      const cleanHistory: {
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        tool_calls?: any[];
        tool_call_id?: string;
      }[] = this.history.map(({ role, content, tool_calls, tool_call_id }) => ({
        role,
        content,
        tool_calls,
        tool_call_id,
      }));

      if (systemPrompt) {
        cleanHistory.unshift({ role: "system", content: systemPrompt });
      }

      // Context: Current Item Metadata
      const item = this.currentItem;
      if (item) {
        const itemMetadata = [
          `Title: ${item.getField("title")}`,
          `Item Type: ${item.itemType}`,
          `Date: ${item.getField("date")}`,
          `Creators: ${item
            .getCreatorsJSON()
            .map((c: any) =>
              c.firstName ? `${c.firstName} ${c.lastName}` : c.name,
            )
            .join(", ")}`,
          `Abstract: ${item.getField("abstractNote") || "N/A"}`,
        ].join("\n");

        cleanHistory.push({
          role: "system",
          content: `Current Document Context:\n${itemMetadata}`,
        });
      }

      const { registry } = await import("../services/tools");

      await agent.run(
        cleanHistory as any,
        {
          onToken: async (token: string) => {
            aiResponseText += token;
            // Update the current model step content
            const lastModelStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "model");
            if (lastModelStep && lastModelStep.type === "model") {
              lastModelStep.content = aiResponseText;
            }
            const html = await marked.parse(aiResponseText);
            updateAiMessage(html, reasoningSteps);
          },
          onRequestDebug: (payload: any) => {
            this.lastDebugPayload = payload;
          },
          onToolStart: (toolName: string, args: Record<string, any>) => {
            // Mark current model step as done
            const lastModelStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "model");
            if (lastModelStep && lastModelStep.type === "model") {
              lastModelStep.status = "done";
            }
            // Push a new tool step
            reasoningSteps.push({
              type: "tool",
              status: "running",
              name: toolName,
              args,
            });
            updateAiMessage(aiResponseText ? "" : "", reasoningSteps);
          },
          onToolResult: async (toolName: string, result: string) => {
            // Update the last tool step with result
            const lastToolStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "tool");
            if (lastToolStep && lastToolStep.type === "tool") {
              lastToolStep.status = "done";
              lastToolStep.result =
                result.length > 200 ? result.substring(0, 200) + "..." : result;
            }
            // Push a new model thinking step for the next iteration
            reasoningSteps.push({
              type: "model",
              status: "thinking",
              content: "",
            });
            aiResponseText = ""; // Reset for next model response
            updateAiMessage("", reasoningSteps);
          },
          onComplete: async () => {
            // Mark final model step as done
            const lastModelStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "model");
            if (lastModelStep && lastModelStep.type === "model") {
              lastModelStep.status = "done";
              lastModelStep.content = aiResponseText;
            }
            this.history.push({
              role: "assistant",
              content: aiResponseText,
              id: aiMsgId,
            });
            try {
              const html = await marked.parse(aiResponseText);
              updateAiMessage(html || aiResponseText, reasoningSteps);
            } catch (e) {
              updateAiMessage(aiResponseText, reasoningSteps);
            }
            this.enableInput();
          },
          onError: (err: Error) => {
            updateAiMessage(
              `<span style="color:red">Error: ${err.message}</span>`,
              reasoningSteps,
            );
            this.enableInput();
          },
        },
        registry.getTools(),
      );
    } catch (e: any) {
      updateAiMessage(`Error: ${e.message}`);
      this.enableInput();
    }
  }

  private enableInput() {
    if (this.textarea) {
      this.textarea.disabled = false;
      this.textarea.focus();
    }
    if (this.sendBtn) {
      this.sendBtn.disabled = false;
      this.sendBtn.style.opacity = "1";
      this.sendBtn.style.cursor = "pointer";
    }
  }

  private appendMessage(
    text: string,
    sender: "You" | "AI",
    id: string,
    renderHtml = false,
    reasoningSteps: any[] = [],
  ) {
    if (!this.messagesArea) return () => {};

    const rowDiv = this.container.ownerDocument!.createElement("div");
    rowDiv.style.display = "flex";
    rowDiv.style.justifyContent = sender === "You" ? "flex-end" : "flex-start";
    rowDiv.style.alignItems = "flex-start";
    rowDiv.style.marginBottom = "8px";
    rowDiv.style.position = "relative";
    if (sender === "AI") {
      rowDiv.style.width = "100%";
    }

    const msgDiv = this.container.ownerDocument!.createElement("div");
    msgDiv.style.fontSize = "13px";
    msgDiv.style.lineHeight = "1.4";
    msgDiv.style.wordBreak = "break-word";

    if (sender === "You") {
      msgDiv.style.padding = "8px 12px";
      msgDiv.style.borderRadius = "12px";
      msgDiv.style.maxWidth = "85%";
      msgDiv.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
      msgDiv.style.backgroundColor = "#0969da";
      msgDiv.style.color = "#ffffff";
    } else {
      // AI: full width, no bubble
      msgDiv.style.width = "100%";
      msgDiv.style.color = "var(--material-on-background, #24292f)";
      msgDiv.style.paddingBottom = "4px";
    }

    const textSpan = this.container.ownerDocument!.createElement("div");
    if (renderHtml) textSpan.className = "markdown-body";
    msgDiv.appendChild(textSpan);
    rowDiv.appendChild(msgDiv);

    // Actions (Copy, Delete)
    const actionsDiv = this.createActionsDiv(
      id,
      rowDiv,
      textSpan,
      renderHtml,
      sender,
    );
    rowDiv.appendChild(actionsDiv);

    rowDiv.onmouseenter = () => {
      actionsDiv.style.opacity = "1";
    };
    rowDiv.onmouseleave = () => {
      actionsDiv.style.opacity = "0";
    };

    this.messagesArea.appendChild(rowDiv);
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;

    // Update function
    const updateFn = (newText: string, currentReasoningSteps: any[] = []) => {
      if (renderHtml) {
        // Build Chain of Thought timeline HTML
        let cotHtml = "";
        if (currentReasoningSteps.length > 0) {
          const stepsHtml = currentReasoningSteps
            .map((step: any) => {
              if (step.type === "model") {
                if (step.status !== "thinking") return ""; // hide done model steps
                return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;color:#888;font-size:0.85em;font-style:italic;">&#x23F3; Thinking...</div>`;
              } else if (step.type === "tool") {
                const isRunning = step.status === "running";
                // Args as pills
                const argPills = step.args
                  ? Object.values(step.args)
                      .map(
                        (v: any) =>
                          `<span style="display:inline-block;background:#f0f0f0;border:1px solid #ddd;border-radius:12px;padding:1px 8px;font-size:0.75em;color:#444;margin-right:4px;">${String(v).substring(0, 60)}</span>`,
                      )
                      .join("")
                  : "";
                const resultHtml = step.result
                  ? `<div style="margin-top:5px;padding:5px 8px;background:#f6f8fa;border-radius:4px;border-left:3px solid #d0d7de;font-size:0.78em;color:#555;line-height:1.4;">${step.result.substring(0, 300)}${step.result.length > 300 ? "..." : ""}</div>`
                  : isRunning
                    ? `<div style="margin-top:3px;font-size:0.78em;color:#888;font-style:italic;">Running...</div>`
                    : "";
                return `<div style="padding:5px 0;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:13px;">&#x1F50D;</span>
                    <span style="font-size:0.85em;color:#333;font-weight:500;">${step.name.replace(/_/g, " ")}</span>
                  </div>
                  ${argPills ? `<div style="margin-top:4px;padding-left:20px;">${argPills}</div>` : ""}
                  ${resultHtml ? `<div style="padding-left:20px;">${resultHtml}</div>` : ""}
                </div>`;
              }
              return "";
            })
            .filter(Boolean)
            .join(
              `<div style="height:1px;background:#eee;margin:1px 0;"></div>`,
            );

          if (stepsHtml) {
            cotHtml = `<details open="open" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
              <summary style="cursor:pointer;padding:8px 12px;background:#fafafa;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;gap:6px;list-style:none;font-size:0.85em;font-weight:600;color:#444;">
                <span>&#x1F4AC;</span>
                <span style="flex:1;">Chain of Thought</span>
                <span style="color:#999;font-size:0.8em;">&#x25B2;</span>
              </summary>
              <div style="padding:6px 12px;">
                ${stepsHtml}
              </div>
            </details>`;
          }
        }

        // Fix for XHTML (Zotero) compatibility: self-close void tags
        // Replace <br>, <hr>, <img>, <input>, <meta>, <link> that aren't already self-closed
        const fixedText = newText.replace(
          /<(br|hr|img|input|meta|link)(\s[^>]*)?>(?!\s*\/)/gi,
          "<$1$2 />",
        );

        try {
          textSpan.innerHTML = cotHtml + fixedText;
        } catch (e) {
          Zotero.debug(`ChatUI Parse/Render Error: ${e}`);
          // Fallback: try without CoT block
          try {
            textSpan.innerHTML = fixedText;
          } catch (e2) {
            textSpan.textContent = newText;
          }
        }
      } else {
        textSpan.textContent = newText;
      }
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    };

    // Initial render
    updateFn(text, reasoningSteps);

    return updateFn;
  }

  private createActionsDiv(
    id: string,
    rowDiv: HTMLElement,
    textSpan: HTMLElement,
    renderHtml: boolean,
    sender: string,
  ) {
    const actionsDiv = this.container.ownerDocument!.createElement("div");
    actionsDiv.style.opacity = "0";
    actionsDiv.style.transition = "opacity 0.2s";
    actionsDiv.style.position = "absolute";
    actionsDiv.style.bottom = "-28px";
    actionsDiv.style.right = sender === "You" ? "0" : "auto";
    actionsDiv.style.left = sender === "You" ? "auto" : "0";
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "4px";
    actionsDiv.style.backgroundColor = "var(--material-background, #fff)";
    actionsDiv.style.borderRadius = "4px";
    actionsDiv.style.padding = "2px";
    actionsDiv.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
    actionsDiv.style.zIndex = "10";

    const copyBtn = this.createActionButton(ICONS.Copy, "Copy", async () => {
      const content = renderHtml
        ? textSpan.textContent || ""
        : textSpan.textContent || "";
      await navigator.clipboard.writeText(content);
      // Visual feedback omitted for brevity but can be added back
    });
    actionsDiv.appendChild(copyBtn);

    if (sender === "AI") {
      const regenBtn = this.createActionButton(
        ICONS.Refresh,
        "Regenerate",
        () => {
          // Simple regenerate: remove last AI message and trigger send from history logic?
          // The original code re-ran the whole stream.
          // We would need to implement regenerate logic properly in ChatUI if we want it.
          // For now, removing the row and triggering a "retry" is complex without refactoring history management further.
          // I'll leave it as a TODO or simple delete for now to match strict refactor.
          // actually original code did `history = ...` and called `appendMessage`.
          rowDiv.remove();
          this.history = this.history.filter((h) => h.id !== id);
          // Trigger re-send? Logic is a bit complex to duplicate here inside createActionsDiv.
          // Maybe just allow delete.
        },
      );
      // actionsDiv.appendChild(regenBtn); // Commented out for now to ensure stability first
    }

    const deleteBtn = this.createActionButton(ICONS.Trash, "Delete", () => {
      rowDiv.remove();
      this.history = this.history.filter((h) => h.id !== id);
    });
    actionsDiv.appendChild(deleteBtn);

    return actionsDiv;
  }

  private createIconButton(svg: string, title: string, onClick: () => void) {
    const btn = this.container.ownerDocument!.createElement("button");
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.padding = "4px";
    btn.style.borderRadius = "4px";
    btn.style.color = "var(--material-text-medium, #6e7781)";
    btn.title = title;
    btn.appendChild(this.createSvgIcon(svg, 20));
    btn.onclick = onClick;
    return btn;
  }

  private createActionButton(svg: string, title: string, onClick: () => void) {
    const btn = this.createIconButton(svg, title, onClick);
    btn.onmouseover = () => {
      btn.style.color = "var(--material-text-color, #24292f)";
      btn.style.backgroundColor = "var(--material-hover, rgba(0,0,0,0.05))";
    };
    btn.onmouseout = () => {
      btn.style.color = "var(--material-text-medium, #6e7781)";
      btn.style.backgroundColor = "transparent";
    };
    // adjustments for size?
    const s = btn.querySelector("svg");
    if (s) {
      s.setAttribute("width", "14");
      s.setAttribute("height", "14");
    }
    return btn;
  }

  private createSvgIcon(svgString: string, size = 16, color = "currentColor") {
    const temp = this.container.ownerDocument!.createElement("div");
    temp.innerHTML = svgString;
    const svg = temp.firstElementChild as HTMLElement;
    if (svg) {
      svg.setAttribute("width", size.toString());
      svg.setAttribute("height", size.toString());
      if (color !== "currentColor") {
        svg.style.stroke = color;
      }
    }
    return svg;
  }

  private generateId() {
    return Math.random().toString(36).substring(2, 11);
  }

  public async showToolsModal() {
    const { registry } = await import("../services/tools");
    const tools = registry.getTools();
    const win = Zotero.getMainWindow();
    if (!win) return;

    // Serialize tool metadata (not the execute function) and pass executeTool as a callback
    const toolsMeta = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    win.openDialog(
      "chrome://zoteroask/content/tools.xhtml",
      "zoteroask-tools",
      "chrome,centerscreen,resizable=yes,width=560,height=620",
      {
        tools: toolsMeta,
        executeTool: async (name: string, args: any) => {
          const tool = registry.getTool(name);
          if (!tool) throw new Error(`Tool "${name}" not found`);
          return tool.execute(args);
        },
      },
    );
  }

  public showDebugModal() {
    const win = Zotero.getMainWindow();
    if (!win) return;

    const payload = this.lastDebugPayload
      ? JSON.stringify(this.lastDebugPayload)
      : null;

    win.openDialog(
      "chrome://zoteroask/content/debug.xhtml",
      "zoteroask-debug",
      "chrome,centerscreen,resizable=yes,width=600,height=500",
      payload,
    );
  }
}
