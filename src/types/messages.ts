import { Context, ElementIdentifier } from './types';

// Tab information type
export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  isScriptInjectionAllowed: boolean;
}

// Message payloads type
export interface MessagePayloads {
  ELEMENT_HIDDEN: { identifier: ElementIdentifier };
  INITIALIZE_CONTENT: undefined;
  RESTORE_HIDDEN_ELEMENTS: undefined;
  UNHIDE_ELEMENT: { identifier: ElementIdentifier };
  SIDEPANEL_CLOSED: undefined;
  TOGGLE_SELECTION_MODE: { enabled: boolean };
}

// Base message structure
export interface BaseMessage {
  type: keyof MessagePayloads;
  payload: unknown;
  source: Context;
  target: Context;
  timestamp: number;
}

// Message handler type
export type MessageHandler<T extends BaseMessage = BaseMessage> = (message: T) => void;

// Message type
export type Message<T extends keyof MessagePayloads> = BaseMessage & {
  type: T;
  payload: MessagePayloads[T];
};

// Union of all message types
export type ExtensionMessage = {
  [K in keyof MessagePayloads]: Message<K>;
}[keyof MessagePayloads];
