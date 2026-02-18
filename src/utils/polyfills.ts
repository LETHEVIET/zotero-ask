// Polyfill console for Zotero environment if it doesn't exist
if (typeof console === "undefined") {
  (globalThis as any).console = {
    log: (msg: any) => Zotero.debug(`[Log] ${msg}`),
    error: (msg: any) => Zotero.debug(`[Error] ${msg}`),
    warn: (msg: any) => Zotero.debug(`[Warn] ${msg}`),
    info: (msg: any) => Zotero.debug(`[Info] ${msg}`),
    debug: (msg: any) => Zotero.debug(`[Debug] ${msg}`),
  };
}
