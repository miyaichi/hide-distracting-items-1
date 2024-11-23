// src/types/types.ts
export interface ElementIdentifier {
  domPath: string;
  tagName: string;
  classNames: string[];
  id?: string;
  textContent?: string;
}

export interface DomainSettings {
  hiddenElements: ElementIdentifier[];
  enabled: boolean;
}

export interface Connection {
  [key: string]: chrome.runtime.Port;
}

export interface TabState {
  tabId: number;
  windowId: number;
  domain: string | null;
  contentScriptPort: chrome.runtime.Port | null;
  sidePanelPort: chrome.runtime.Port | null;
}
