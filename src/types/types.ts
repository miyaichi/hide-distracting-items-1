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

export type ConnectionName = `content-script-${number}` | 'sidepanel' | 'background';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type MessageType =
  | 'CLEAR_ALL'
  | 'CONTENT_ACTION'
  | 'DOMAIN_INFO'
  | 'ELEMENT_SELECTED'
  | 'HIDE_ELEMENT'
  | 'INITIALIZE_CONTENT'
  | 'SHOW_ELEMENT'
  | 'TAB_ACTIVATED'
  | 'TOGGLE_SELECTION_MODE';

export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
  target: ConnectionName;
}

export interface ContentActionMessage extends BaseMessage {
  type: 'CONTENT_ACTION';
  action: ContentAction;
}

export interface DomainInfoMessage extends BaseMessage {
  type: 'DOMAIN_INFO';
  domain: string;
  url: string;
}

export interface ElementSelectedMessage extends BaseMessage {
  type: 'ELEMENT_SELECTED';
  domain: string;
  identifier: ElementIdentifier;
}

export interface InitializeContentMessage extends BaseMessage {
  type: 'INITIALIZE_CONTENT';
  domain: string;
}

export interface ShowElementMessage extends BaseMessage {
  type: 'SHOW_ELEMENT';
  identifier: ElementIdentifier;
}

export interface TabActivatedMessage extends BaseMessage {
  type: 'TAB_ACTIVATED';
  tabId: number;
}

export interface ToggleSelectionModeMessage extends BaseMessage {
  type: 'TOGGLE_SELECTION_MODE';
  enabled: boolean;
}

export type ContentAction = { action: 'TOGGLE_SELECTION_MODE'; enabled: boolean };

export type Message =
  | ContentActionMessage
  | DomainInfoMessage
  | ElementSelectedMessage
  | InitializeContentMessage
  | ShowElementMessage
  | TabActivatedMessage
  | ToggleSelectionModeMessage
  | (BaseMessage & { type: 'CLEAR_ALL' });
