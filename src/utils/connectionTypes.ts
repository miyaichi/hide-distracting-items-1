// src/utils/connectionTypes.ts
import { ConnectionName } from '../types/types';

/**
 * Check if the connection name is a content script connection
 * @param name - The connection name
 * @returns True if the connection name is a content script connection
 */
export const isContentScriptConnection = (
  name: ConnectionName
): name is `content-script-${number}` => {
  return name.startsWith('content-script-');
};

/**
 * Get the tab id from a content script connection name
 * @param name - The connection name
 * @returns The tab id
 */
export const getTabIdFromConnectionName = (name: ConnectionName) => {
  if (!isContentScriptConnection(name)) {
    return null;
  }
  return parseInt(name.split('-')[2]);
};

/**
 * Create a content script connection name
 * @param tabId - The tab id
 * @returns The connection name
 */
export const createContentScriptName = (tabId: number): ConnectionName => {
  return `content-script-${tabId}`;
};
