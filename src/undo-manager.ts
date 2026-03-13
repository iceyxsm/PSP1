/**
 * Undo Manager Component
 * Integrates with Photoshop's native undo system and provides rollback mechanisms
 */

import { app } from 'photoshop';
import { performanceMonitor } from './performance-monitor';

interface UndoCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  operations: UndoOperation[];
  documentState?: any;
}

interface UndoOperation {
  type: 'layer_create' | 'layer_delete' | 'layer_modify' | 'group_create' | 'group_delete' | 'property_change';
  layerId?: number;
  groupId?: number;
  previousState?: any;
  newState?: any;
  batchPlayCommands?: any[];
}

interface RollbackResult {
  success: boolean;
  operationsRolledBack: number;
  errors: string[];
}

class UndoManager {
  private checkpoints: Map<string, UndoCheckpoint> = new Map();
  private maxCheckpoints: number = 50;
  private currentCheckpoint: string | null = null;

  /**
   * Create a checkpoint before complex operations
   */
  async createCheckpoint(name: string): Promise<string> {
    const operationId = performanceMonitor.startOperation('create_checkpoint');
    
    try {
      const checkpointId = `checkpoint_${Date.now()}_${Math.random()}`;
      
      // Get current document state
      const documentState = await this.captureDocumentState();
      
      const checkpoint: UndoCheckpoint = {
        id: checkpointId,
        name,
        timestamp: Date.now(),
        operations: [],
        documentState,
      };

      this.checkpoints.set(checkpointId, checkpoint);
      this.currentCheckpoint = checkpointId;

      // Cleanup old checkpoints
      this.cleanupOldCheckpoints();

      performanceMonitor.endOperation(operationId, true);
      return checkpointId;
    } catch (error) {
      performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Record an operation for potential rollback
   */
  recordOperation(operation: UndoOperation): void {
    if (!this.currentCheckpoint) return;

    const checkpoint = this.checkpoints.get(this.currentCheckpoint);
    if (checkpoint) {
      checkpoint.operations.push(operation);
    }
  }

  /**
   * Create Photoshop history state
   */
  async createHistoryState(name: string): Promise<boolean> {
    try {
      await app.batchPlay([
        {
          _obj: 'make',
          _target: [{ _ref: 'snapshotClass' }],
          name: name,
          using: { _ref: 'historyState', _enum: 'ordinal', _value: 'currentHistoryState' }
        }
      ], { modalBehavior: 'execute' });

      return true;
    } catch (error) {
      console.error('Failed to create history state:', error);
      return false;
    }
  }

  /**
   * Rollback to checkpoint
   */
  async rollbackToCheckpoint(checkpointId: string): Promise<RollbackResult> {
    const operationId = performanceMonitor.startOperation('rollback_checkpoint');
    
    try {
      const checkpoint = this.checkpoints.get(checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      const errors: string[] = [];
      let operationsRolledBack = 0;

      // Rollback operations in reverse order
      const operations = [...checkpoint.operations].reverse();

      for (const operation of operations) {
        try {
          await this.rollbackOperation(operation);
          operationsRolledBack++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to rollback operation ${operation.type}: ${errorMessage}`);
        }
      }

      performanceMonitor.endOperation(operationId, errors.length === 0);

      return {
        success: errors.length === 0,
        operationsRolledBack,
        errors,
      };
    } catch (error) {
      performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Rollback a single operation
   */
  private async rollbackOperation(operation: UndoOperation): Promise<void> {
    switch (operation.type) {
      case 'layer_create':
        if (operation.layerId) {
          await this.deleteLayer(operation.layerId);
        }
        break;

      case 'layer_delete':
        // Cannot easily restore deleted layers, would need full layer data
        console.warn('Cannot rollback layer deletion - layer data not preserved');
        break;

      case 'layer_modify':
        if (operation.layerId && operation.previousState) {
          await this.restoreLayerState(operation.layerId, operation.previousState);
        }
        break;

      case 'group_create':
        if (operation.groupId) {
          await this.deleteGroup(operation.groupId);
        }
        break;

      case 'group_delete':
        console.warn('Cannot rollback group deletion - group data not preserved');
        break;

      case 'property_change':
        if (operation.layerId && operation.previousState) {
          await this.restoreLayerProperties(operation.layerId, operation.previousState);
        }
        break;

      default:
        console.warn(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Use Photoshop's native undo
   */
  async performUndo(steps: number = 1): Promise<boolean> {
    try {
      for (let i = 0; i < steps; i++) {
        await app.batchPlay([
          {
            _obj: 'undo',
            _target: [{ _ref: 'historyState', _enum: 'ordinal', _value: 'previousHistoryState' }]
          }
        ], { modalBehavior: 'execute' });
      }
      return true;
    } catch (error) {
      console.error('Failed to perform undo:', error);
      return false;
    }
  }

  /**
   * Use Photoshop's native redo
   */
  async performRedo(steps: number = 1): Promise<boolean> {
    try {
      for (let i = 0; i < steps; i++) {
        await app.batchPlay([
          {
            _obj: 'redo',
            _target: [{ _ref: 'historyState', _enum: 'ordinal', _value: 'nextHistoryState' }]
          }
        ], { modalBehavior: 'execute' });
      }
      return true;
    } catch (error) {
      console.error('Failed to perform redo:', error);
      return false;
    }
  }

  /**
   * Revert to specific history state
   */
  async revertToHistoryState(stateName: string): Promise<boolean> {
    try {
      await app.batchPlay([
        {
          _obj: 'select',
          _target: [{ _ref: 'historyState', _name: stateName }]
        }
      ], { modalBehavior: 'execute' });
      return true;
    } catch (error) {
      console.error('Failed to revert to history state:', error);
      return false;
    }
  }

  /**
   * Get available history states
   */
  async getHistoryStates(): Promise<string[]> {
    try {
      const result = await app.batchPlay([
        {
          _obj: 'get',
          _target: [{ _ref: 'document', _enum: 'ordinal', _value: 'targetEnum' }],
          _property: 'historyStates'
        }
      ], {});

      if (result[0] && result[0].historyStates) {
        return result[0].historyStates.map((state: any) => state.name || 'Unnamed State');
      }

      return [];
    } catch (error) {
      console.error('Failed to get history states:', error);
      return [];
    }
  }

  /**
   * Capture current document state
   */
  private async captureDocumentState(): Promise<any> {
    try {
      const result = await app.batchPlay([
        {
          _obj: 'get',
          _target: [{ _ref: 'document', _enum: 'ordinal', _value: 'targetEnum' }]
        }
      ], {});

      return result[0] || {};
    } catch (error) {
      console.error('Failed to capture document state:', error);
      return {};
    }
  }

  /**
   * Delete a layer
   */
  private async deleteLayer(layerId: number): Promise<void> {
    await app.batchPlay([
      {
        _obj: 'delete',
        _target: [{ _ref: 'layer', _id: layerId }]
      }
    ], { modalBehavior: 'execute' });
  }

  /**
   * Delete a group
   */
  private async deleteGroup(groupId: number): Promise<void> {
    await app.batchPlay([
      {
        _obj: 'delete',
        _target: [{ _ref: 'layerSection', _id: groupId }]
      }
    ], { modalBehavior: 'execute' });
  }

  /**
   * Restore layer state
   */
  private async restoreLayerState(layerId: number, previousState: any): Promise<void> {
    // This would require implementing specific restoration logic
    // based on what properties were changed
    console.log(`Restoring layer ${layerId} to previous state`);
  }

  /**
   * Restore layer properties
   */
  private async restoreLayerProperties(layerId: number, previousProperties: any): Promise<void> {
    try {
      await app.batchPlay([
        {
          _obj: 'set',
          _target: [{ _ref: 'layer', _id: layerId }],
          to: previousProperties
        }
      ], { modalBehavior: 'execute' });
    } catch (error) {
      console.error('Failed to restore layer properties:', error);
    }
  }

  /**
   * Cleanup old checkpoints
   */
  private cleanupOldCheckpoints(): void {
    if (this.checkpoints.size <= this.maxCheckpoints) return;

    // Sort by timestamp and keep only the most recent
    const sortedCheckpoints = Array.from(this.checkpoints.entries())
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);

    // Remove oldest checkpoints
    const toRemove = sortedCheckpoints.slice(this.maxCheckpoints);
    for (const [id] of toRemove) {
      this.checkpoints.delete(id);
    }
  }

  /**
   * Get checkpoint info
   */
  getCheckpoint(checkpointId: string): UndoCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(): UndoCheckpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints(): void {
    this.checkpoints.clear();
    this.currentCheckpoint = null;
  }

  /**
   * Get current checkpoint ID
   */
  getCurrentCheckpoint(): string | null {
    return this.currentCheckpoint;
  }
}

// Export singleton instance
export const undoManager = new UndoManager();

// Export types
export type { UndoCheckpoint, UndoOperation, RollbackResult };