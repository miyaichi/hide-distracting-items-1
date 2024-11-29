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

export interface ElementActionMessage extends BaseMessage {
  type: 'HIDE_ELEMENT' | 'SHOW_ELEMENT';
  identifier: ElementIdentifier;
}

export interface ToggleSelectionModeMessage extends BaseMessage {
  type: 'TOGGLE_SELECTION_MODE';
  enabled: boolean;
}

export type ContentAction =
  | { action: 'APPLY_RULES'; rules: number; applyed: number }
  | { action: 'CLEAR_ALL' }
  | { action: 'SHOW_ELEMENT'; identifier: ElementIdentifier }
  | { action: 'TOGGLE_SELECTION_MODE'; enabled: boolean };

export type Message =
  | InitializeContentMessage
  | ToggleSelectionModeMessage
  | ElementActionMessage
  | DomainInfoMessage
  | ElementSelectedMessage
  | ContentActionMessage
  | (BaseMessage & { type: 'CLEAR_ALL' });
