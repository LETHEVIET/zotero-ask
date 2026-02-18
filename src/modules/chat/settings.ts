export function openSettingsWindow() {
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
