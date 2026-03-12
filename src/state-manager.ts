/**
 * State Manager
 * Manages plugin state and user preferences
 */

interface PluginPreferences {
  autoGroupingEnabled: boolean;
  defaultOutlineWidth: number;
  defaultOutlineColor: { r: number; g: number; b: number };
  recentColors: string[];
  recentFonts: string[];
  namingTemplates: NamingTemplate[];
  keyboardShortcuts: KeyboardShortcut[];
  panelLayout: PanelLayout;
  performanceMode: 'fast' | 'balanced' | 'quality';
  autoCommit: boolean;
  autoPush: boolean;
}

interface NamingTemplate {
  id: string;
  name: string;
  pattern: string;
  variables: string[];
  examples: string[];
}

interface KeyboardShortcut {
  command: string;
  key: string;
  modifiers: string[];
  enabled: boolean;
}

interface PanelLayout {
  width: number;
  height: number;
  sections: {
    quickActions: boolean;
    bulkStyling: boolean;
    groupManagement: boolean;
    imageTools: boolean;
  };
}

interface SessionState {
  activeDocumentId?: number;
  selectedLayerIds: number[];
  lastOperation?: string;
  operationCount: number;
  sessionStartTime: Date;
}

class StateManager {
  private preferences: PluginPreferences;
  private sessionState: SessionState;
  private storageKey: string = 'psp1-preferences';
  private isInitialized: boolean = false;

  constructor() {
    this.preferences = this.getDefaultPreferences();
    this.sessionState = this.getDefaultSessionState();
  }

  /**
   * Initialize state manager and load preferences
   */
  async initialize(): Promise<boolean> {
    try {
      await this.loadPreferences();
      this.isInitialized = true;
      console.log('State manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize state manager:', error);
      return false;
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): PluginPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  async updatePreferences(updates: Partial<PluginPreferences>): Promise<void> {
    this.preferences = {
      ...this.preferences,
      ...updates,
    };

    await this.savePreferences();
    console.log('Preferences updated:', updates);
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(): Promise<void> {
    this.preferences = this.getDefaultPreferences();
    await this.savePreferences();
    console.log('Preferences reset to defaults');
  }

  /**
   * Get session state
   */
  getSessionState(): SessionState {
    return { ...this.sessionState };
  }

  /**
   * Update session state
   */
  updateSessionState(updates: Partial<SessionState>): void {
    this.sessionState = {
      ...this.sessionState,
      ...updates,
    };
  }

  /**
   * Add recent color
   */
  addRecentColor(color: string): void {
    const recentColors = this.preferences.recentColors.filter(c => c !== color);
    recentColors.unshift(color);
    
    // Keep only last 10 colors
    this.preferences.recentColors = recentColors.slice(0, 10);
    this.savePreferences();
  }

  /**
   * Add recent font
   */
  addRecentFont(font: string): void {
    const recentFonts = this.preferences.recentFonts.filter(f => f !== font);
    recentFonts.unshift(font);
    
    // Keep only last 10 fonts
    this.preferences.recentFonts = recentFonts.slice(0, 10);
    this.savePreferences();
  }

  /**
   * Add naming template
   */
  addNamingTemplate(template: NamingTemplate): void {
    const existingIndex = this.preferences.namingTemplates.findIndex(t => t.id === template.id);
    
    if (existingIndex >= 0) {
      this.preferences.namingTemplates[existingIndex] = template;
    } else {
      this.preferences.namingTemplates.push(template);
    }
    
    this.savePreferences();
  }

  /**
   * Remove naming template
   */
  removeNamingTemplate(templateId: string): void {
    this.preferences.namingTemplates = this.preferences.namingTemplates.filter(
      t => t.id !== templateId
    );
    this.savePreferences();
  }

  /**
   * Update keyboard shortcut
   */
  updateKeyboardShortcut(command: string, shortcut: Partial<KeyboardShortcut>): void {
    const existingIndex = this.preferences.keyboardShortcuts.findIndex(s => s.command === command);
    
    if (existingIndex >= 0) {
      this.preferences.keyboardShortcuts[existingIndex] = {
        ...this.preferences.keyboardShortcuts[existingIndex],
        ...shortcut,
      };
    } else {
      this.preferences.keyboardShortcuts.push({
        command,
        key: shortcut.key || '',
        modifiers: shortcut.modifiers || [],
        enabled: shortcut.enabled !== false,
      });
    }
    
    this.savePreferences();
  }

  /**
   * Update panel layout
   */
  updatePanelLayout(layout: Partial<PanelLayout>): void {
    this.preferences.panelLayout = {
      ...this.preferences.panelLayout,
      ...layout,
    };
    this.savePreferences();
  }

  /**
   * Increment operation count
   */
  incrementOperationCount(): void {
    this.sessionState.operationCount++;
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    duration: number;
    operationCount: number;
    operationsPerMinute: number;
  } {
    const now = new Date();
    const duration = now.getTime() - this.sessionState.sessionStartTime.getTime();
    const durationMinutes = duration / (1000 * 60);
    const operationsPerMinute = durationMinutes > 0 
      ? this.sessionState.operationCount / durationMinutes 
      : 0;

    return {
      duration,
      operationCount: this.sessionState.operationCount,
      operationsPerMinute,
    };
  }

  // Private methods

  private getDefaultPreferences(): PluginPreferences {
    return {
      autoGroupingEnabled: true,
      defaultOutlineWidth: 2,
      defaultOutlineColor: { r: 0, g: 0, b: 0 },
      recentColors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'],
      recentFonts: ['Arial', 'Helvetica', 'Times New Roman'],
      namingTemplates: [
        {
          id: 'default',
          name: 'Default',
          pattern: 'Group {timestamp}',
          variables: ['timestamp'],
          examples: ['Group 10:30:45'],
        },
        {
          id: 'content-based',
          name: 'Content Based',
          pattern: '{type} Group',
          variables: ['type'],
          examples: ['Text Group', 'Shape Group'],
        },
      ],
      keyboardShortcuts: [
        {
          command: 'createLayerGroup',
          key: 'G',
          modifiers: ['Ctrl', 'Shift'],
          enabled: true,
        },
        {
          command: 'toggleVisibility',
          key: 'H',
          modifiers: ['Ctrl'],
          enabled: true,
        },
      ],
      panelLayout: {
        width: 320,
        height: 600,
        sections: {
          quickActions: true,
          bulkStyling: true,
          groupManagement: true,
          imageTools: true,
        },
      },
      performanceMode: 'balanced',
      autoCommit: true,
      autoPush: true,
    };
  }

  private getDefaultSessionState(): SessionState {
    return {
      selectedLayerIds: [],
      operationCount: 0,
      sessionStartTime: new Date(),
    };
  }

  private async loadPreferences(): Promise<void> {
    try {
      // In a real implementation, this would load from localStorage or UXP storage
      // For now, we'll use a simulated storage
      const stored = this.getStoredPreferences();
      
      if (stored) {
        this.preferences = {
          ...this.getDefaultPreferences(),
          ...stored,
        };
        console.log('Preferences loaded from storage');
      } else {
        console.log('No stored preferences found, using defaults');
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      this.preferences = this.getDefaultPreferences();
    }
  }

  private async savePreferences(): Promise<void> {
    try {
      // In a real implementation, this would save to localStorage or UXP storage
      this.setStoredPreferences(this.preferences);
      console.log('Preferences saved to storage');
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  private getStoredPreferences(): PluginPreferences | null {
    try {
      // Simulate localStorage access
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : null;
      }
      return null;
    } catch (error) {
      console.error('Failed to get stored preferences:', error);
      return null;
    }
  }

  private setStoredPreferences(preferences: PluginPreferences): void {
    try {
      // Simulate localStorage access
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(preferences));
      }
    } catch (error) {
      console.error('Failed to set stored preferences:', error);
    }
  }
}

// Export singleton instance
export const stateManager = new StateManager();

// Export types for external use
export type {
  PluginPreferences,
  NamingTemplate,
  KeyboardShortcut,
  PanelLayout,
  SessionState,
};