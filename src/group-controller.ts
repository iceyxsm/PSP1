/**
 * Group Controller Component
 * Manages group visibility, naming, and keyboard shortcuts
 */

import { photoshopBridge } from './photoshop-bridge';
import { layerInspector } from './layer-inspector';
import { commandDispatcher } from './command-dispatcher';
import { stateManager } from './state-manager';

interface GroupInfo {
  id: number;
  name: string;
  visible: boolean;
  layerCount: number;
  childLayers: number[];
}

interface NamingTemplate {
  id: string;
  name: string;
  pattern: string;
  variables: string[];
  examples: string[];
}

interface VisibilityOperation {
  groupIds: number[];
  visible: boolean;
  preserveChildState: boolean;
}

class GroupController {
  private namingTemplates: Map<string, NamingTemplate> = new Map();
  private keyboardShortcuts: Map<string, () => Promise<void>> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeKeyboardShortcuts();
  }

  /**
   * Toggle visibility for a single group
   */
  async toggleGroupVisibility(
    groupId: number
  ): Promise<{ success: boolean; newState: boolean }> {
    try {
      // Get current visibility state
      const currentState = await photoshopBridge.getLayerVisibility(groupId);
      const newState = !currentState;

      // Toggle visibility
      const result = await commandDispatcher.executeCommand(
        'setLayerVisibility',
        groupId,
        newState
      );

      if (result.success) {
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        newState,
      };
    } catch (error) {
      console.error('Failed to toggle group visibility:', error);
      return { success: false, newState: false };
    }
  }

  /**
   * Batch visibility operations for multiple groups
   */
  async batchVisibilityOperation(
    operation: VisibilityOperation
  ): Promise<{ success: boolean; affectedGroups: number[] }> {
    try {
      const results = await Promise.all(
        operation.groupIds.map(async groupId => {
          const result = await commandDispatcher.executeCommand(
            'setLayerVisibility',
            groupId,
            operation.visible
          );
          return { groupId, success: result.success };
        })
      );

      const affectedGroups = results
        .filter(r => r.success)
        .map(r => r.groupId);

      if (affectedGroups.length > 0) {
        stateManager.incrementOperationCount();
      }

      return {
        success: affectedGroups.length === operation.groupIds.length,
        affectedGroups,
      };
    } catch (error) {
      console.error('Failed batch visibility operation:', error);
      return { success: false, affectedGroups: [] };
    }
  }

  /**
   * Show all groups
   */
  async showAllGroups(): Promise<{ success: boolean; count: number }> {
    try {
      const groups = await this.getAllGroups();
      const groupIds = groups.map(g => g.id);

      const result = await this.batchVisibilityOperation({
        groupIds,
        visible: true,
        preserveChildState: false,
      });

      return {
        success: result.success,
        count: result.affectedGroups.length,
      };
    } catch (error) {
      console.error('Failed to show all groups:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Hide all groups
   */
  async hideAllGroups(): Promise<{ success: boolean; count: number }> {
    try {
      const groups = await this.getAllGroups();
      const groupIds = groups.map(g => g.id);

      const result = await this.batchVisibilityOperation({
        groupIds,
        visible: false,
        preserveChildState: false,
      });

      return {
        success: result.success,
        count: result.affectedGroups.length,
      };
    } catch (error) {
      console.error('Failed to hide all groups:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Generate intelligent group name based on content
   */
  async generateGroupName(
    layerIds: number[],
    templateId?: string
  ): Promise<string> {
    try {
      // Analyze layers to determine content
      const analyses = await layerInspector.analyzeLayers(layerIds);

      if (templateId && this.namingTemplates.has(templateId)) {
        return this.applyNamingTemplate(templateId, analyses);
      }

      // Default intelligent naming
      return this.generateDefaultName(analyses);
    } catch (error) {
      console.error('Failed to generate group name:', error);
      return 'New Group';
    }
  }

  /**
   * Apply naming template to generate group name
   */
  private applyNamingTemplate(
    templateId: string,
    analyses: any[]
  ): string {
    const template = this.namingTemplates.get(templateId);
    if (!template) return 'New Group';

    let name = template.pattern;

    // Replace variables in template
    for (const variable of template.variables) {
      const value = this.getVariableValue(variable, analyses);
      name = name.replace(`{${variable}}`, value);
    }

    return name;
  }

  /**
   * Get variable value for naming template
   */
  private getVariableValue(variable: string, analyses: any[]): string {
    switch (variable) {
      case 'count':
        return analyses.length.toString();
      case 'type':
        const types = [...new Set(analyses.map(a => a.type))];
        return types.length === 1 ? types[0] : 'Mixed';
      case 'date':
        return new Date().toLocaleDateString();
      case 'time':
        return new Date().toLocaleTimeString();
      case 'content':
        return this.analyzeContent(analyses);
      default:
        return '';
    }
  }

  /**
   * Generate default intelligent name
   */
  private generateDefaultName(analyses: any[]): string {
    if (analyses.length === 0) return 'Empty Group';

    // Analyze layer types
    const types = analyses.map(a => a.type);
    const uniqueTypes = [...new Set(types)];

    if (uniqueTypes.length === 1) {
      // All same type
      const type = uniqueTypes[0];
      return `${type} Group (${analyses.length})`;
    }

    // Mixed types - analyze content
    const content = this.analyzeContent(analyses);
    return content || `Mixed Group (${analyses.length})`;
  }

  /**
   * Analyze content to suggest name
   */
  private analyzeContent(analyses: any[]): string {
    // Look for common patterns in layer names
    const names = analyses.map(a => a.name || '').filter(n => n);
    
    if (names.length === 0) return '';

    // Find common prefix
    const commonPrefix = this.findCommonPrefix(names);
    if (commonPrefix.length > 3) {
      return commonPrefix.trim();
    }

    // Find common words
    const words = names.flatMap(n => n.split(/[\s_-]+/));
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 2) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Find most common word
    let maxCount = 0;
    let commonWord = '';
    
    for (const [word, count] of wordCounts) {
      if (count > maxCount && count > names.length / 2) {
        maxCount = count;
        commonWord = word;
      }
    }

    return commonWord || '';
  }

  /**
   * Find common prefix in strings
   */
  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];

    let prefix = strings[0];
    
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }

    return prefix;
  }

  /**
   * Validate group name
   */
  validateGroupName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Name cannot be empty' };
    }

    if (name.length > 255) {
      return { valid: false, error: 'Name too long (max 255 characters)' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Rename group with validation
   */
  async renameGroup(
    groupId: number,
    newName: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate name
    const validation = this.validateGroupName(newName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const result = await commandDispatcher.executeCommand(
        'renameLayer',
        groupId,
        newName
      );

      if (result.success) {
        stateManager.incrementOperationCount();
      }

      return { success: result.success };
    } catch (error) {
      console.error('Failed to rename group:', error);
      return { success: false, error: 'Failed to rename group' };
    }
  }

  /**
   * Get auto-complete suggestions for group names
   */
  async getNameSuggestions(
    partial: string,
    layerIds: number[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Generate intelligent suggestions
    const generated = await this.generateGroupName(layerIds);
    if (generated.toLowerCase().includes(partial.toLowerCase())) {
      suggestions.push(generated);
    }

    // Add template-based suggestions
    for (const template of this.namingTemplates.values()) {
      for (const example of template.examples) {
        if (example.toLowerCase().includes(partial.toLowerCase())) {
          suggestions.push(example);
        }
      }
    }

    // Add recent group names from state
    const recentNames = stateManager.getRecentGroupNames();
    for (const name of recentNames) {
      if (name.toLowerCase().includes(partial.toLowerCase())) {
        suggestions.push(name);
      }
    }

    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 10);
  }

  /**
   * Register keyboard shortcut
   */
  registerShortcut(
    keys: string,
    action: () => Promise<void>
  ): { success: boolean } {
    try {
      this.keyboardShortcuts.set(keys, action);
      return { success: true };
    } catch (error) {
      console.error('Failed to register shortcut:', error);
      return { success: false };
    }
  }

  /**
   * Execute keyboard shortcut
   */
  async executeShortcut(keys: string): Promise<{ success: boolean }> {
    const action = this.keyboardShortcuts.get(keys);
    
    if (!action) {
      return { success: false };
    }

    try {
      await action();
      return { success: true };
    } catch (error) {
      console.error('Failed to execute shortcut:', error);
      return { success: false };
    }
  }

  /**
   * Get all groups in document
   */
  private async getAllGroups(): Promise<GroupInfo[]> {
    try {
      const result = await commandDispatcher.executeCommand('getAllGroups');
      return result.data || [];
    } catch (error) {
      console.error('Failed to get all groups:', error);
      return [];
    }
  }

  /**
   * Initialize default naming templates
   */
  private initializeDefaultTemplates(): void {
    this.namingTemplates.set('type-count', {
      id: 'type-count',
      name: 'Type and Count',
      pattern: '{type} Group ({count})',
      variables: ['type', 'count'],
      examples: ['Text Group (5)', 'Shape Group (3)', 'Mixed Group (8)'],
    });

    this.namingTemplates.set('content', {
      id: 'content',
      name: 'Content-based',
      pattern: '{content}',
      variables: ['content'],
      examples: ['Header', 'Navigation', 'Footer'],
    });

    this.namingTemplates.set('date-time', {
      id: 'date-time',
      name: 'Date and Time',
      pattern: 'Group {date} {time}',
      variables: ['date', 'time'],
      examples: ['Group 2026-03-12 14:30', 'Group 2026-03-12 15:45'],
    });
  }

  /**
   * Initialize default keyboard shortcuts
   */
  private initializeKeyboardShortcuts(): void {
    // Toggle visibility: Ctrl+Shift+H
    this.registerShortcut('Ctrl+Shift+H', async () => {
      const groups = await this.getAllGroups();
      if (groups.length > 0) {
        await this.toggleGroupVisibility(groups[0].id);
      }
    });

    // Show all: Ctrl+Shift+S
    this.registerShortcut('Ctrl+Shift+S', async () => {
      await this.showAllGroups();
    });

    // Hide all: Ctrl+Shift+D
    this.registerShortcut('Ctrl+Shift+D', async () => {
      await this.hideAllGroups();
    });
  }
}

// Export singleton instance
export const groupController = new GroupController();

// Export types
export type { GroupInfo, NamingTemplate, VisibilityOperation };
