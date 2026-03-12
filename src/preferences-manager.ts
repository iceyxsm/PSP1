/**
 * Preferences Manager Component
 * Handles persistent user preference storage and management
 */

import { storage } from 'uxp';

interface UserPreferences {
  // Grouping preferences
  autoGroupingEnabled: boolean;
  defaultGroupingStrategy: 'content' | 'spatial' | 'name' | 'type';
  groupingConfidenceThreshold: number;

  // Styling preferences
  recentColors: string[];
  recentFonts: string[];
  maxRecentItems: number;
  defaultOutlineWidth: number;
  defaultOutlineColor: string;
  defaultOutlinePosition: 'inside' | 'outside' | 'center';

  // Naming preferences
  namingTemplateId: string;
  autoRenameGroups: boolean;
  namingConvention: 'descriptive' | 'sequential' | 'timestamp';

  // UI preferences
  panelWidth: number;
  panelHeight: number;
  collapsedSections: string[];
  theme: 'auto' | 'light' | 'dark';
  showTooltips: boolean;
  showKeyboardShortcuts: boolean;

  // Performance preferences
  maxLayersForAutoGrouping: number;
  enableProgressIndicators: boolean;
  batchOperationSize: number;
  memoryCleanupInterval: number;

  // Version control preferences
  autoCommit: boolean;
  autoPush: boolean;
  commitMessageTemplate: string;

  // Advanced preferences
  enablePerformanceMonitoring: boolean;
  enableDebugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // Grouping
  autoGroupingEnabled: true,
  defaultGroupingStrategy: 'content',
  groupingConfidenceThreshold: 0.7,

  // Styling
  recentColors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'],
  recentFonts: [],
  maxRecentItems: 10,
  defaultOutlineWidth: 3,
  defaultOutlineColor: '#000000',
  defaultOutlinePosition: 'outside',

  // Naming
  namingTemplateId: 'type-count',
  autoRenameGroups: false,
  namingConvention: 'descriptive',

  // UI
  panelWidth: 300,
  panelHeight: 600,
  collapsedSections: [],
  theme: 'auto',
  showTooltips: true,
  showKeyboardShortcuts: true,

  // Performance
  maxLayersForAutoGrouping: 100,
  enableProgressIndicators: true,
  batchOperationSize: 10,
  memoryCleanupInterval: 300000,

  // Version control
  autoCommit: false,
  autoPush: false,
  commitMessageTemplate: 'Auto-commit: {operation}',

  // Advanced
  enablePerformanceMonitoring: true,
  enableDebugMode: false,
  logLevel: 'info',
};

class PreferencesManager {
  private preferences: UserPreferences;
  private preferencesFile: string = 'psp1-preferences.json';
  private isLoaded: boolean = false;
  private changeListeners: Array<(prefs: UserPreferences) => void> = [];

  constructor() {
    this.preferences = { ...DEFAULT_PREFERENCES };
  }

  /**
   * Initialize and load preferences
   */
  async initialize(): Promise<void> {
    try {
      await this.loadPreferences();
      this.isLoaded = true;
      console.log('Preferences loaded successfully');
    } catch (error) {
      console.error('Failed to load preferences, using defaults:', error);
      this.preferences = { ...DEFAULT_PREFERENCES };
      this.isLoaded = true;
    }
  }

  /**
   * Load preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const dataFolder = await storage.localFileSystem.getDataFolder();
      const prefsFile = await dataFolder.getEntry(this.preferencesFile);

      if (prefsFile && prefsFile.isFile) {
        const contents = await (prefsFile as any).read();
        const loadedPrefs = JSON.parse(contents);

        // Merge with defaults to handle new preferences
        this.preferences = {
          ...DEFAULT_PREFERENCES,
          ...loadedPrefs,
        };

        // Validate preferences
        this.validatePreferences();
      }
    } catch (error) {
      // File doesn't exist or error reading, use defaults
      console.log('No existing preferences found, using defaults');
    }
  }

  /**
   * Save preferences to storage
   */
  async savePreferences(): Promise<boolean> {
    try {
      const dataFolder = await storage.localFileSystem.getDataFolder();
      const prefsFile = await dataFolder.createFile(this.preferencesFile, {
        overwrite: true,
      });

      await (prefsFile as any).write(JSON.stringify(this.preferences, null, 2));

      console.log('Preferences saved successfully');
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return false;
    }
  }

  /**
   * Get all preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Get specific preference
   */
  getPreference<K extends keyof UserPreferences>(
    key: K
  ): UserPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Set specific preference
   */
  async setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<boolean> {
    this.preferences[key] = value;
    return await this.savePreferences();
  }

  /**
   * Update multiple preferences
   */
  async updatePreferences(
    updates: Partial<UserPreferences>
  ): Promise<boolean> {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };

    this.validatePreferences();
    return await this.savePreferences();
  }

  /**
   * Reset to default preferences
   */
  async resetToDefaults(): Promise<boolean> {
    this.preferences = { ...DEFAULT_PREFERENCES };
    return await this.savePreferences();
  }

  /**
   * Reset specific preference to default
   */
  async resetPreference<K extends keyof UserPreferences>(
    key: K
  ): Promise<boolean> {
    this.preferences[key] = DEFAULT_PREFERENCES[key];
    return await this.savePreferences();
  }

  /**
   * Validate preferences
   */
  private validatePreferences(): void {
    // Validate numeric ranges
    this.preferences.groupingConfidenceThreshold = Math.max(
      0,
      Math.min(1, this.preferences.groupingConfidenceThreshold)
    );

    this.preferences.maxRecentItems = Math.max(1, Math.min(20, this.preferences.maxRecentItems));
    this.preferences.defaultOutlineWidth = Math.max(1, Math.min(20, this.preferences.defaultOutlineWidth));
    this.preferences.maxLayersForAutoGrouping = Math.max(10, this.preferences.maxLayersForAutoGrouping);
    this.preferences.batchOperationSize = Math.max(1, Math.min(100, this.preferences.batchOperationSize));

    // Validate arrays
    if (this.preferences.recentColors.length > this.preferences.maxRecentItems) {
      this.preferences.recentColors = this.preferences.recentColors.slice(0, this.preferences.maxRecentItems);
    }

    if (this.preferences.recentFonts.length > this.preferences.maxRecentItems) {
      this.preferences.recentFonts = this.preferences.recentFonts.slice(0, this.preferences.maxRecentItems);
    }
  }

  /**
   * Add recent color
   */
  async addRecentColor(color: string): Promise<void> {
    // Remove if already exists
    this.preferences.recentColors = this.preferences.recentColors.filter(c => c !== color);

    // Add to beginning
    this.preferences.recentColors.unshift(color);

    // Trim to max
    if (this.preferences.recentColors.length > this.preferences.maxRecentItems) {
      this.preferences.recentColors = this.preferences.recentColors.slice(0, this.preferences.maxRecentItems);
    }

    await this.savePreferences();
  }

  /**
   * Add recent font
   */
  async addRecentFont(font: string): Promise<void> {
    // Remove if already exists
    this.preferences.recentFonts = this.preferences.recentFonts.filter(f => f !== font);

    // Add to beginning
    this.preferences.recentFonts.unshift(font);

    // Trim to max
    if (this.preferences.recentFonts.length > this.preferences.maxRecentItems) {
      this.preferences.recentFonts = this.preferences.recentFonts.slice(0, this.preferences.maxRecentItems);
    }

    await this.savePreferences();
  }

  /**
   * Toggle collapsed section
   */
  async toggleCollapsedSection(sectionId: string): Promise<void> {
    const index = this.preferences.collapsedSections.indexOf(sectionId);
    
    if (index > -1) {
      this.preferences.collapsedSections.splice(index, 1);
    } else {
      this.preferences.collapsedSections.push(sectionId);
    }

    await this.savePreferences();
  }

  /**
   * Export preferences
   */
  exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences
   */
  async importPreferences(json: string): Promise<boolean> {
    try {
      const imported = JSON.parse(json);

      // Validate imported data
      if (typeof imported !== 'object') {
        throw new Error('Invalid preferences format');
      }

      // Merge with defaults
      this.preferences = {
        ...DEFAULT_PREFERENCES,
        ...imported,
      };

      this.validatePreferences();
      return await this.savePreferences();
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: (prefs: UserPreferences) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: (prefs: UserPreferences) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const prefs = this.getPreferences();
    for (const listener of this.changeListeners) {
      try {
        listener(prefs);
      } catch (error) {
        console.error('Error in preference change listener:', error);
      }
    }
  }

  /**
   * Get preference migration info
   */
  getMigrationInfo(): {
    currentVersion: string;
    needsMigration: boolean;
  } {
    // In future versions, check if preferences need migration
    return {
      currentVersion: '1.0.0',
      needsMigration: false,
    };
  }

  /**
   * Migrate preferences to new version
   */
  async migratePreferences(fromVersion: string, toVersion: string): Promise<boolean> {
    console.log(`Migrating preferences from ${fromVersion} to ${toVersion}`);
    
    // Future migration logic here
    
    return await this.savePreferences();
  }
}

// Export singleton instance
export const preferencesManager = new PreferencesManager();

// Export types
export type { UserPreferences };
export { DEFAULT_PREFERENCES };
