import { marked } from "marked";
import { getPref } from "../../utils/prefs";
import { ICONS } from "./icons";
import { DEFAULT_SYSTEM_PROMPT } from "./constants";

export class ChatUI {
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
    if (this.currentItem && this.currentItem.id !== item.id) {
      this.clearChat();
    }
    this.currentItem = item;
  }

  destroy() {
    // Cleanup listeners if any (e.g. reader listeners)
  }

  clearChat() {
    this.history = [];
    if (this.messagesArea) this.messagesArea.innerHTML = "";
  }

  private renderInitialUI() {
    this.container.innerHTML = "";

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
    mainDiv.style.overflow = "hidden";
    mainDiv.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    mainDiv.style.position = "relative";

    // Messages Area
    this.messagesArea = this.container.ownerDocument!.createElement("div");
    this.messagesArea.id = "zotero-ask-messages";
    this.messagesArea.style.flexGrow = "1";
    this.messagesArea.style.flexShrink = "1";
    this.messagesArea.style.overflowY = "auto";
    this.messagesArea.style.padding = "10px";
    this.messagesArea.style.display = "flex";
    this.messagesArea.style.flexDirection = "column";
    this.messagesArea.style.gap = "12px";
    this.messagesArea.style.minHeight = "0";
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

  private async sendMessage(regenerateMessage?: string) {
    const value = regenerateMessage ?? this.textarea.value.trim();
    if (!value) return;

    this.textarea.disabled = true;
    this.sendBtn.disabled = true;
    this.sendBtn.style.opacity = "0.6";
    this.sendBtn.style.cursor = "not-allowed";

    let fullMessage = value;

    // Only process selection context and append user bubble for new messages (not regenerate)
    if (!regenerateMessage) {
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
    }

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
    // Track text for the current model step (reset per model call)
    let currentStepText = "";

    try {
      const { agent } = await import("../../services/agent");

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

      const { registry } = await import("../../services/tools");

      await agent.run(
        cleanHistory as any,
        {
          onToken: async (token: string) => {
            currentStepText += token;
            aiResponseText += token;
            // Update the current model step content
            const lastModelStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "model");
            if (lastModelStep && lastModelStep.type === "model") {
              lastModelStep.content = currentStepText;
            }
            const html = await this.buildAgentResponseHtml(reasoningSteps);
            updateAiMessage(html);
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
            this.buildAgentResponseHtml(reasoningSteps).then((h) =>
              updateAiMessage(h),
            );
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
            currentStepText = "";
            const html = await this.buildAgentResponseHtml(reasoningSteps);
            updateAiMessage(html);
          },
          onComplete: async () => {
            // Mark final model step as done
            const lastModelStep = [...reasoningSteps]
              .reverse()
              .find((s) => s.type === "model");
            if (lastModelStep && lastModelStep.type === "model") {
              lastModelStep.status = "done";
              lastModelStep.content = currentStepText;
            }
            this.history.push({
              role: "assistant",
              content: aiResponseText,
              id: aiMsgId,
            });
            const html = await this.buildAgentResponseHtml(reasoningSteps);
            updateAiMessage(html);
            this.enableInput();
          },
          onError: (err: Error) => {
            updateAiMessage(
              `<span style="color:red">Error: ${err.message}</span>`,
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

    // Update function — just sets innerHTML/textContent
    const updateFn = (html: string) => {
      if (renderHtml) {
        // Fix for XHTML (Zotero) compatibility: self-close void tags
        const fixed = html.replace(
          /<(br|hr|img|input|meta|link)(\s[^>]*)?>(?!\s*\/)/gi,
          "<$1$2 />",
        );
        try {
          textSpan.innerHTML = fixed;
        } catch (e) {
          Zotero.debug(`ChatUI Parse/Render Error: ${e}`);
          textSpan.textContent = html;
        }
      } else {
        textSpan.textContent = html;
      }
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    };

    // Initial render
    updateFn(text);

    return updateFn;
  }

  /**
   * Parse content into thinking (<think> blocks) and response text.
   */
  private splitThinkContent(content: string): {
    thinking: string;
    response: string;
    isStillThinking: boolean;
  } {
    let thinking = "";
    let remaining = content;

    // Extract completed <think>...</think> blocks
    remaining = remaining.replace(/<think>([\s\S]*?)<\/think>/g, (_, p1) => {
      thinking += p1;
      return "";
    });

    // Check for unclosed <think> tag (still streaming thinking)
    const unclosedMatch = remaining.match(/<think>([\s\S]*)$/);
    let isStillThinking = false;
    if (unclosedMatch) {
      thinking += unclosedMatch[1];
      remaining = remaining.replace(/<think>[\s\S]*$/, "");
      isStillThinking = true;
    }

    return {
      thinking: thinking.trim(),
      response: remaining.trim(),
      isStillThinking,
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Build the full HTML for an AI message from its reasoning steps.
   * Renders sequentially: thoughts → text → tool calls → text → ...
   */
  private async buildAgentResponseHtml(steps: any[]): Promise<string> {
    let html = "";

    for (const step of steps) {
      if (step.type === "model") {
        const content = step.content || "";
        const { thinking, response, isStillThinking } =
          this.splitThinkContent(content);

        // Collapsible thinking section
        if (thinking || isStillThinking) {
          const escapedThinking = this.escapeHtml(thinking || "...");
          html += `<details${isStillThinking ? ' open="open"' : ""} style="margin-bottom:8px;">
            <summary style="cursor:pointer;font-size:0.85em;color:#888;padding:4px 0;display:flex;align-items:center;gap:6px;">
              ${ICONS.Brain} Thought${isStillThinking ? "..." : ""}
            </summary>
            <div style="padding:4px 0 4px 20px;font-size:0.82em;color:#666;line-height:1.5;white-space:pre-wrap;">${escapedThinking}</div>
          </details>`;
        }

        // Waiting spinner (no content yet, actively thinking)
        if (step.status === "thinking" && !content) {
          html += `<div style="display:flex;align-items:center;gap:6px;color:#888;font-size:0.85em;font-style:italic;padding:4px 0;">${ICONS.Loader} Thinking...</div>`;
        }

        // Response text as markdown
        if (response) {
          try {
            const parsed = await marked.parse(response);
            html += parsed;
          } catch (_e) {
            html += `<p>${this.escapeHtml(response)}</p>`;
          }
        }
      } else if (step.type === "tool") {
        const isRunning = step.status === "running";
        const icon = isRunning ? ICONS.Loader : ICONS.CircleCheck;

        // Tool call line
        html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;font-size:0.85em;">`;
        html += `<span style="display:flex;color:${isRunning ? "#888" : "#1a7f37"};">${icon}</span>`;
        html += `<span style="font-weight:500;color:#333;">${step.name.replace(/_/g, " ")}</span>`;

        // Arg pills
        if (step.args) {
          for (const v of Object.values(step.args)) {
            html += `<span style="display:inline-block;background:#f0f0f0;border:1px solid #ddd;border-radius:12px;padding:1px 8px;font-size:0.8em;color:#444;margin-left:4px;">${this.escapeHtml(String(v).substring(0, 60))}</span>`;
          }
        }
        html += `</div>`;

        // Result preview
        if (step.result) {
          html += `<div style="margin:2px 0 8px 22px;padding:5px 8px;background:#f6f8fa;border-radius:4px;border-left:3px solid #d0d7de;font-size:0.78em;color:#555;line-height:1.4;max-height:100px;overflow-y:auto;">${this.escapeHtml(step.result.substring(0, 300))}${step.result.length > 300 ? "..." : ""}</div>`;
        } else if (isRunning) {
          html += `<div style="margin:2px 0 8px 22px;font-size:0.78em;color:#888;font-style:italic;">Running...</div>`;
        }
      }
    }

    return html;
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
      const content = textSpan.textContent || "";
      await navigator.clipboard.writeText(content);
    });
    actionsDiv.appendChild(copyBtn);

    if (sender === "AI") {
      const regenBtn = this.createActionButton(
        ICONS.Refresh,
        "Regenerate",
        () => {
          // Find the last user message content before this AI message
          const aiIdx = this.history.findIndex((h) => h.id === id);
          const lastUserMsg = this.history
            .slice(0, aiIdx === -1 ? undefined : aiIdx)
            .reverse()
            .find((h) => h.role === "user");
          if (!lastUserMsg) return;

          // Remove the AI message from history and DOM
          rowDiv.remove();
          this.history = this.history.filter((h) => h.id !== id);

          // Re-send with the same user message (skips appending a new user bubble)
          this.sendMessage(lastUserMsg.content);
        },
      );
      actionsDiv.appendChild(regenBtn);
    }

    const deleteBtn = this.createActionButton(ICONS.Trash, "Delete", () => {
      rowDiv.remove();
      this.history = this.history.filter((h) => h.id !== id);
    });
    actionsDiv.appendChild(deleteBtn);

    return actionsDiv;
  }

  private createActionButton(svg: string, title: string, onClick: () => void) {
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
    btn.onmouseover = () => {
      btn.style.color = "var(--material-text-color, #24292f)";
      btn.style.backgroundColor = "var(--material-hover, rgba(0,0,0,0.05))";
    };
    btn.onmouseout = () => {
      btn.style.color = "var(--material-text-medium, #6e7781)";
      btn.style.backgroundColor = "transparent";
    };
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
    const { registry } = await import("../../services/tools");
    const tools = registry.getAllTools();
    const win = Zotero.getMainWindow();
    if (!win) return;

    const toolsMeta = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      enabled: registry.isEnabled(t.name),
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
        toggleTool: (name: string, enabled: boolean) => {
          registry.setEnabled(name, enabled);
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
