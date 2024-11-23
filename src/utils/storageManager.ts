// src/utils/storageManager.ts
import { DomainSettings, ElementIdentifier } from '../types/types';

interface StorageOperation {
  success: boolean;
  error?: Error;
  data?: any;
}

interface StorageValidationResult {
  isValid: boolean;
  errors: string[];
}

export class StorageManager {
  private static readonly DEFAULT_SETTINGS: DomainSettings = {
    hiddenElements: [],
    enabled: true,
  };

  /**
   * 指定したドメインの設定を取得
   */
  static async getDomainSettings(domain: string): Promise<DomainSettings> {
    if (!this.isValidDomain(domain)) {
      console.error('Invalid domain provided:', domain);
      return this.DEFAULT_SETTINGS;
    }

    try {
      console.log('Getting settings for domain:', domain);
      const result = await chrome.storage.sync.get(domain);
      console.log('Retrieved settings:', result);

      const settings = result[domain] || this.DEFAULT_SETTINGS;
      const validation = this.validateSettings(settings);

      if (!validation.isValid) {
        console.warn('Invalid settings found:', validation.errors);
        return this.DEFAULT_SETTINGS;
      }

      return settings;
    } catch (error) {
      console.error('Error getting domain settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  /**
   * ドメインの設定を保存
   */
  static async saveDomainSettings(
    domain: string,
    settings: DomainSettings
  ): Promise<StorageOperation> {
    if (!this.isValidDomain(domain)) {
      return {
        success: false,
        error: new Error('Invalid domain provided'),
      };
    }

    const validation = this.validateSettings(settings);
    if (!validation.isValid) {
      return {
        success: false,
        error: new Error(`Invalid settings: ${validation.errors.join(', ')}`),
      };
    }

    try {
      console.log('Saving settings for domain:', domain);
      console.log('Settings to save:', settings);

      await chrome.storage.sync.set({ [domain]: settings });

      // 保存の確認
      const saved = await this.getDomainSettings(domain);
      console.log('Verified saved settings:', saved);

      const isVerified = this.areSettingsEqual(settings, saved);
      if (!isVerified) {
        throw new Error('Saved settings verification failed');
      }

      return {
        success: true,
        data: saved,
      };
    } catch (error) {
      console.error('Error saving domain settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error during save'),
      };
    }
  }

  /**
   * すべての保存された設定を取得
   */
  static async getAllStoredDomains(): Promise<{ [domain: string]: DomainSettings }> {
    try {
      const all = await chrome.storage.sync.get(null);
      console.log('All stored settings:', all);

      // 不正な設定を除外
      const validSettings: { [domain: string]: DomainSettings } = {};
      for (const [domain, settings] of Object.entries(all)) {
        if (this.isValidDomain(domain) && this.validateSettings(settings).isValid) {
          validSettings[domain] = settings as DomainSettings;
        }
      }

      return validSettings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }

  /**
   * すべての設定をクリア
   */
  static async clearAllSettings(): Promise<StorageOperation> {
    try {
      await chrome.storage.sync.clear();
      console.log('All settings cleared');
      return { success: true };
    } catch (error) {
      console.error('Error clearing settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to clear settings'),
      };
    }
  }

  /**
   * 特定のドメインの設定を削除
   */
  static async removeDomainSettings(domain: string): Promise<StorageOperation> {
    try {
      await chrome.storage.sync.remove(domain);
      console.log(`Settings removed for domain: ${domain}`);
      return { success: true };
    } catch (error) {
      console.error(`Error removing settings for domain ${domain}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to remove settings'),
      };
    }
  }

  /**
   * ストレージの使用状況を取得
   */
  static async getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      return {
        bytesInUse,
        quotaBytes: chrome.storage.sync.QUOTA_BYTES,
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { bytesInUse: 0, quotaBytes: 0 };
    }
  }

  private static isValidDomain(domain: string): boolean {
    return (
      domain !== undefined &&
      domain !== null &&
      domain.length > 0 &&
      domain.length <= 255 &&
      /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/.test(domain)
    );
  }

  private static validateSettings(settings: any): StorageValidationResult {
    const errors: string[] = [];

    if (!settings) {
      errors.push('Settings object is null or undefined');
      return { isValid: false, errors };
    }

    if (!Array.isArray(settings.hiddenElements)) {
      errors.push('hiddenElements must be an array');
    } else {
      settings.hiddenElements.forEach((element: ElementIdentifier, index: number) => {
        if (!element.domPath) {
          errors.push(`Element at index ${index} missing domPath`);
        }
        if (!element.tagName) {
          errors.push(`Element at index ${index} missing tagName`);
        }
      });
    }

    if (typeof settings.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static areSettingsEqual(a: DomainSettings, b: DomainSettings): boolean {
    if (a.enabled !== b.enabled) return false;
    if (a.hiddenElements.length !== b.hiddenElements.length) return false;

    return a.hiddenElements.every((elementA, index) => {
      const elementB = b.hiddenElements[index];
      return (
        elementA.domPath === elementB.domPath &&
        elementA.tagName === elementB.tagName &&
        JSON.stringify(elementA.classNames) === JSON.stringify(elementB.classNames)
      );
    });
  }
}
