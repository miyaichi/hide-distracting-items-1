export interface ElementIdentifier {
  domPath: string;
  tagName: string;
  classNames: string[];
  id?: string;
  textContent?: string;
  children?: ElementIdentifier[];
  parentPath?: string;
}

export interface DomainSettings {
  hiddenElements: ElementIdentifier[];
  enabled: boolean;
}

export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

declare global {
  interface Window {
    contentScriptInitialized?: boolean;
  }
}
