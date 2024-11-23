// src/utils/storageManager.ts
import { DomainSettings } from '../types/types';

export class StorageManager {
  static async getDomainSettings(domain: string): Promise<DomainSettings> {
    try {
      console.log('Getting settings for domain:', domain);
      const result = await chrome.storage.sync.get(domain);
      console.log('Retrieved settings:', result);
      return result[domain] || { hiddenElements: [], enabled: true };
    } catch (error) {
      console.error('Error getting domain settings:', error);
      return { hiddenElements: [], enabled: true };
    }
  }

  static async saveDomainSettings(domain: string, settings: DomainSettings): Promise<void> {
    try {
      console.log('Saving settings for domain:', domain);
      console.log('Settings to save:', settings);
      await chrome.storage.sync.set({ [domain]: settings });

      // 保存の確認
      const saved = await this.getDomainSettings(domain);
      console.log('Verified saved settings:', saved);
    } catch (error) {
      console.error('Error saving domain settings:', error);
      throw error;
    }
  }

  // デバッグ用のユーティリティメソッド
  static async getAllStoredDomains(): Promise<{ [domain: string]: DomainSettings }> {
    try {
      const all = await chrome.storage.sync.get(null);
      console.log('All stored settings:', all);
      return all;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }

  static async clearAllSettings(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      console.log('All settings cleared');
    } catch (error) {
      console.error('Error clearing settings:', error);
    }
  }
}
