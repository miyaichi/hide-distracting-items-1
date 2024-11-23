// src/utils/storageManager.ts

import { DomainSettings } from '../types/types';

export class StorageManager {
  static async getDomainSettings(domain: string): Promise<DomainSettings> {
    const result = await chrome.storage.sync.get(domain);
    return result[domain] || { hiddenElements: [], enabled: true };
  }

  static async saveDomainSettings(domain: string, settings: DomainSettings): Promise<void> {
    await chrome.storage.sync.set({ [domain]: settings });
  }
}
