/**
 * Plugin Manager
 * Central integration point that wires all components together
 */

import { photoshopBridge } from './photoshop-bridge';
import { layerInspector } from './layer-inspector';
import { commandDispatcher } from './command-dispatcher';
import { stateManager } from './state-manager';
import { errorHandler } from './error-handler';
import { autoGrouper } from './auto-grouper';
import { styleManager } from './style-manager';
import { groupController } from './group-controller';
import { imageReplacer } from './image-replacer';
import { performanceMonitor } from './performance-monitor';
import { batchOptimizer } from './batch-optimizer';
import { versionControl } from './version-control';
import { preferencesManager } from './preferences-manager';

interface PluginInitResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface PluginStatus {
  initialized: boolean;
  version: string;
  components: {
    [key: string]: {
      status: 'active' | 'inactive' | 'error';
      message?: string;
    };
  };
}

class PluginManager {
  private initialized: boolean = false;
  private version: string = '1.0.0';
  private initErrors: string[] = [];
  private initWarnings: string[] = [];

  /**
   * Initialize all plugin components
   */
  async initialize(): Promise<PluginInitResult> {
    console.log('Initializing PSP1 - Layer Manager Pro...');

    try {
      // Initialize preferences first
      await this.initializePreferences();

      // Initialize core systems
      await this.initializeCoreSystem();

      // Initialize version control
      await this.initializeVersionControl();

      // Initialize performance monitoring
      this.initializePerformanceMonitoring();

      // Register commands
      this.registerCommands();

      // Set up error handlers
      this.setupErrorHandlers();

      // Mark as initialized
      this.initialized = true;

      console.log('PSP1 initialized successfully');

      return {
        success: true,
        errors: this.initErrors,
        warnings: this.initWarnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      this.initErrors.push(errorMessage);

      console.error('Failed to initialize plugin:', error);

      return {
        success: false,
        errors: this.initErrors,
        warnings: this.initWarnings,
      };
    }
  }

  /**
   * Initialize preferences
   */
  private async initializePreferences(): Promise<void> {
    try {
      await preferencesManager.initialize();
      console.log('✓ Preferences initialized');
    } catch (error) {
      this.initWarnings.push('Preferences initialization failed, using defaults');
      console.warn('Preferences initialization failed:', error);
    }
  }

  /**
   * Initialize core system
   */
  private async initializeCoreSystem(): Promise<void> {
    try {
      // Initialize state manager
      await stateManager.initialize();

      // Initialize command dispatcher
      await commandDispatcher.initialize();

      console.log('✓ Core system initialized');
    } catch (error) {
      this.initErrors.push('Core system initialization failed');
      throw error;
    }
  }

  /**
   * Initialize version control
   */
  private async initializeVersionControl(): Promise<void> {
    try {
      const prefs = preferencesManager.getPreferences();
      
      if (prefs.autoCommit || prefs.autoPush) {
        await versionControl.initialize();
        console.log('✓ Version control initialized');
      } else {
        console.log('⊘ Version control disabled in preferences');
      }
    } catch (error) {
      this.initWarnings.push('Version control initialization failed');
      console.warn('Version control initialization failed:', error);
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    const prefs = preferencesManager.getPreferences();
    
    if (prefs.enablePerformanceMonitoring) {
      console.log('✓ Performance monitoring enabled');
    } else {
      console.log('⊘ Performance monitoring disabled');
    }
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
    // Grouping commands
    commandDispatcher.registerCommand('oneClickGroup', async (layerIds: number[]) => {
      const opId = performanceMonitor.startOperation('oneClickGroup', layerIds.length);
      
      try {
        const result = await autoGrouper.createGroup(layerIds);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    commandDispatcher.registerCommand('autoGroup', async (layerIds: number[]) => {
      const opId = performanceMonitor.startOperation('autoGroup', layerIds.length);
      
      try {
        const suggestions = await autoGrouper.suggestGroupings(layerIds);
        performanceMonitor.endOperation(opId, suggestions.length > 0);
        return suggestions;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    // Styling commands
    commandDispatcher.registerCommand('applyTextColor', async (layerIds: number[], color: any) => {
      const opId = performanceMonitor.startOperation('applyTextColor', layerIds.length);
      
      try {
        const result = await styleManager.applyTextColor(layerIds, color);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    commandDispatcher.registerCommand('applyShapeColor', async (layerIds: number[], color: any) => {
      const opId = performanceMonitor.startOperation('applyShapeColor', layerIds.length);
      
      try {
        const result = await styleManager.applyShapeColor(layerIds, color);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    commandDispatcher.registerCommand('applyFont', async (layerIds: number[], fontName: string) => {
      const opId = performanceMonitor.startOperation('applyFont', layerIds.length);
      
      try {
        const result = await styleManager.applyFont(layerIds, fontName);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    // Group management commands
    commandDispatcher.registerCommand('toggleVisibility', async (groupId: number) => {
      const opId = performanceMonitor.startOperation('toggleVisibility');
      
      try {
        const result = await groupController.toggleGroupVisibility(groupId);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    commandDispatcher.registerCommand('renameGroup', async (groupId: number, name: string) => {
      const opId = performanceMonitor.startOperation('renameGroup');
      
      try {
        const result = await groupController.renameGroup(groupId, name);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    // Image commands
    commandDispatcher.registerCommand('replaceImage', async (layerId: number, imagePath: string) => {
      const opId = performanceMonitor.startOperation('replaceImage');
      
      try {
        const result = await imageReplacer.replaceImage(layerId, imagePath);
        performanceMonitor.endOperation(opId, result.success);
        return result;
      } catch (error) {
        performanceMonitor.endOperation(opId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    });

    console.log('✓ Commands registered');
  }

  /**
   * Set up error handlers
   */
  private setupErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      errorHandler.handleError(
        new Error(event.message),
        'CRITICAL',
        { file: event.filename, line: event.lineno, column: event.colno }
      );
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      errorHandler.handleError(
        new Error(event.reason),
        'ERROR',
        { type: 'unhandledRejection' }
      );
    });

    console.log('✓ Error handlers configured');
  }

  /**
   * Get plugin status
   */
  getStatus(): PluginStatus {
    return {
      initialized: this.initialized,
      version: this.version,
      components: {
        preferences: {
          status: 'active',
        },
        coreSystem: {
          status: 'active',
        },
        versionControl: {
          status: preferencesManager.getPreference('autoCommit') ? 'active' : 'inactive',
        },
        performanceMonitoring: {
          status: preferencesManager.getPreference('enablePerformanceMonitoring') ? 'active' : 'inactive',
        },
        autoGrouper: {
          status: 'active',
        },
        styleManager: {
          status: 'active',
        },
        groupController: {
          status: 'active',
        },
        imageReplacer: {
          status: 'active',
        },
      },
    };
  }

  /**
   * Shutdown plugin
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down PSP1...');

    try {
      // Save preferences
      await preferencesManager.savePreferences();

      // Stop performance monitoring cleanup
      performanceMonitor.stopCleanupTimer();

      // Clear state
      this.initialized = false;

      console.log('PSP1 shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Get initialization errors
   */
  getInitErrors(): string[] {
    return [...this.initErrors];
  }

  /**
   * Get initialization warnings
   */
  getInitWarnings(): string[] {
    return [...this.initWarnings];
  }

  /**
   * Check if plugin is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get plugin version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    return performanceMonitor.getPerformanceReport();
  }

  /**
   * Export plugin data
   */
  async exportData(): Promise<{
    preferences: string;
    performanceMetrics: string;
    version: string;
  }> {
    return {
      preferences: preferencesManager.exportPreferences(),
      performanceMetrics: performanceMonitor.exportMetrics(),
      version: this.version,
    };
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();

// Export types
export type { PluginInitResult, PluginStatus };
