/**
 * Command Dispatcher
 * Central routing system for all plugin commands
 */

import { photoshopBridge } from './photoshop-bridge';
import { layerInspector } from './layer-inspector';

interface Command {
  name: string;
  execute: (...args: any[]) => Promise<CommandResult>;
  canExecute?: () => Promise<boolean>;
  description?: string;
}

interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
}

interface CommandContext {
  timestamp: Date;
  commandName: string;
  parameters: any[];
  userId?: string;
}

class CommandDispatcher {
  private commands: Map<string, Command> = new Map();
  private commandHistory: CommandContext[] = [];
  private maxHistorySize: number = 100;
  private isInitialized: boolean = false;

  /**
   * Initialize the command dispatcher
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize dependencies
      await photoshopBridge.initialize();
      
      // Register all commands
      this.registerCommands();
      
      this.isInitialized = true;
      console.log('Command dispatcher initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize command dispatcher:', error);
      return false;
    }
  }

  /**
   * Register a command
   */
  registerCommand(command: Command): void {
    if (this.commands.has(command.name)) {
      console.warn(`Command "${command.name}" is already registered. Overwriting.`);
    }
    
    this.commands.set(command.name, command);
    console.log(`Registered command: ${command.name}`);
  }

  /**
   * Execute a command by name
   */
  async executeCommand(commandName: string, ...args: any[]): Promise<CommandResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: 'Command dispatcher not initialized',
        error: new Error('Dispatcher not initialized'),
      };
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        message: `Command "${commandName}" not found`,
        error: new Error(`Unknown command: ${commandName}`),
      };
    }

    // Check if command can be executed
    if (command.canExecute) {
      const canExecute = await command.canExecute();
      if (!canExecute) {
        return {
          success: false,
          message: `Command "${commandName}" cannot be executed at this time`,
          error: new Error('Command execution not allowed'),
        };
      }
    }

    // Record command in history
    this.recordCommand(commandName, args);

    try {
      console.log(`Executing command: ${commandName}`, args);
      const result = await command.execute(...args);
      
      if (result.success) {
        console.log(`Command "${commandName}" executed successfully`);
      } else {
        console.warn(`Command "${commandName}" failed:`, result.message);
      }
      
      return result;
    } catch (error) {
      console.error(`Command "${commandName}" threw an error:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get list of available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get command history
   */
  getCommandHistory(limit?: number): CommandContext[] {
    const history = [...this.commandHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  // Private methods

  private registerCommands(): void {
    // Layer grouping commands
    this.registerCommand({
      name: 'createLayerGroup',
      description: 'Create a new layer group from selected layers',
      execute: async (name: string, layerIds?: number[]) => {
        try {
          const groupId = await photoshopBridge.createLayerGroup(name, layerIds);
          return {
            success: true,
            message: `Created group "${name}"`,
            data: { groupId },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to create layer group',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
      canExecute: async () => {
        const doc = await photoshopBridge.getActiveDocument();
        return doc !== null;
      },
    });

    // Layer visibility commands
    this.registerCommand({
      name: 'setLayerVisibility',
      description: 'Set visibility for a layer',
      execute: async (layerId: number, visible: boolean) => {
        try {
          await photoshopBridge.setLayerVisibility(layerId, visible);
          return {
            success: true,
            message: `Layer ${visible ? 'shown' : 'hidden'}`,
            data: { layerId, visible },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to set layer visibility',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Layer renaming commands
    this.registerCommand({
      name: 'renameLayer',
      description: 'Rename a layer',
      execute: async (layerId: number, newName: string) => {
        try {
          await photoshopBridge.renameLayer(layerId, newName);
          return {
            success: true,
            message: `Layer renamed to "${newName}"`,
            data: { layerId, newName },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to rename layer',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Text color commands
    this.registerCommand({
      name: 'applyTextColor',
      description: 'Apply color to text layers',
      execute: async (layerIds: number[], color: { r: number; g: number; b: number }) => {
        try {
          await photoshopBridge.applyTextColor(layerIds, color);
          return {
            success: true,
            message: `Applied color to ${layerIds.length} text layers`,
            data: { layerIds, color },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to apply text color',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Shape color commands
    this.registerCommand({
      name: 'applyShapeColor',
      description: 'Apply color to shape layers',
      execute: async (layerIds: number[], color: { r: number; g: number; b: number }) => {
        try {
          await photoshopBridge.applyShapeColor(layerIds, color);
          return {
            success: true,
            message: `Applied color to ${layerIds.length} shape layers`,
            data: { layerIds, color },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to apply shape color',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Font commands
    this.registerCommand({
      name: 'applyFont',
      description: 'Apply font to text layers',
      execute: async (layerIds: number[], fontName: string) => {
        try {
          await photoshopBridge.applyFont(layerIds, fontName);
          return {
            success: true,
            message: `Applied font to ${layerIds.length} text layers`,
            data: { layerIds, fontName },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to apply font',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Stroke effect commands
    this.registerCommand({
      name: 'applyStrokeEffect',
      description: 'Apply stroke effect to layers',
      execute: async (
        layerIds: number[],
        strokeWidth: number,
        strokeColor: { r: number; g: number; b: number }
      ) => {
        try {
          await photoshopBridge.applyStrokeEffect(layerIds, strokeWidth, strokeColor);
          return {
            success: true,
            message: `Applied stroke to ${layerIds.length} layers`,
            data: { layerIds, strokeWidth, strokeColor },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to apply stroke effect',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Image replacement commands
    this.registerCommand({
      name: 'replaceImageContent',
      description: 'Replace image content in a layer',
      execute: async (layerId: number, imagePath: string) => {
        try {
          await photoshopBridge.replaceImageContent(layerId, imagePath);
          return {
            success: true,
            message: 'Image replaced successfully',
            data: { layerId, imagePath },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to replace image',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Layer analysis commands
    this.registerCommand({
      name: 'analyzeLayer',
      description: 'Analyze a layer for intelligent operations',
      execute: async (layerId: number) => {
        try {
          const analysis = await layerInspector.analyzeLayer(layerId);
          return {
            success: true,
            message: 'Layer analyzed successfully',
            data: analysis,
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to analyze layer',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Document analysis commands
    this.registerCommand({
      name: 'analyzeDocument',
      description: 'Analyze all layers in the document',
      execute: async () => {
        try {
          const analyses = await layerInspector.analyzeDocument();
          return {
            success: true,
            message: `Analyzed ${analyses.length} layers`,
            data: analyses,
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to analyze document',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
      canExecute: async () => {
        const doc = await photoshopBridge.getActiveDocument();
        return doc !== null;
      },
    });

    // Layer movement commands
    this.registerCommand({
      name: 'moveLayer',
      description: 'Move a layer to a different position',
      execute: async (
        layerId: number,
        targetLayerId: number,
        position: 'before' | 'after' | 'inside'
      ) => {
        try {
          await photoshopBridge.moveLayer(layerId, targetLayerId, position);
          return {
            success: true,
            message: 'Layer moved successfully',
            data: { layerId, targetLayerId, position },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to move layer',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Layer duplication commands
    this.registerCommand({
      name: 'duplicateLayer',
      description: 'Duplicate a layer',
      execute: async (layerId: number, newName?: string) => {
        try {
          const newLayerId = await photoshopBridge.duplicateLayer(layerId, newName);
          return {
            success: true,
            message: 'Layer duplicated successfully',
            data: { originalLayerId: layerId, newLayerId, newName },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to duplicate layer',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Layer deletion commands
    this.registerCommand({
      name: 'deleteLayer',
      description: 'Delete a layer',
      execute: async (layerId: number) => {
        try {
          await photoshopBridge.deleteLayer(layerId);
          return {
            success: true,
            message: 'Layer deleted successfully',
            data: { layerId },
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to delete layer',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });

    // Get selected layers command
    this.registerCommand({
      name: 'getSelectedLayers',
      description: 'Get currently selected layers',
      execute: async () => {
        try {
          const layers = await photoshopBridge.getSelectedLayers();
          return {
            success: true,
            message: `Found ${layers.length} selected layers`,
            data: layers,
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to get selected layers',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
      canExecute: async () => {
        const doc = await photoshopBridge.getActiveDocument();
        return doc !== null;
      },
    });

    // Get active document command
    this.registerCommand({
      name: 'getActiveDocument',
      description: 'Get active document information',
      execute: async () => {
        try {
          const doc = await photoshopBridge.getActiveDocument();
          if (!doc) {
            return {
              success: false,
              message: 'No active document',
            };
          }
          return {
            success: true,
            message: 'Retrieved active document',
            data: doc,
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to get active document',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    });
  }

  private recordCommand(commandName: string, parameters: any[]): void {
    const context: CommandContext = {
      timestamp: new Date(),
      commandName,
      parameters,
    };

    this.commandHistory.push(context);

    // Trim history if it exceeds max size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
  }
}

// Export singleton instance
export const commandDispatcher = new CommandDispatcher();

// Export types for external use
export type { Command, CommandResult, CommandContext };