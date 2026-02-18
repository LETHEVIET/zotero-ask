import { getLocaleID } from "../../utils/locale";
import { ChatUI } from "./chat-ui";
import { openSettingsWindow } from "./settings";

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
