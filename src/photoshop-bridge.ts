/**
 * Photoshop API Bridge
 * Handles communication with Photoshop using batchPlay and UXP APIs
 */

import { app, action, core } from 'photoshop';

// Type definitions for Photoshop API
interface ActionDescriptor {
  _obj: string;
  _target?: ActionReference[];
  [key: string]: any;
}

interface ActionReference {
  _ref?: string;
  _property?: string;
  _id?: number;
  _index?: number;
  _name?: string;
  _enum?: string;
  _value?: string;
}

interface BatchPlayOptions {
  synchronousExecution?: boolean;
  continueOnError?: boolean;
  immediateRedraw?: boolean;
  modalBehavior?: 'execute' | 'fail';
}

interface LayerInfo {
  id: number;
  name: string;
  kind: string;
  visible: boolean;
  opacity: number;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  parent?: LayerInfo;
}

interface DocumentInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  resolution: number;
  colorMode: string;
  layerCount: number;
}

class PhotoshopBridge {
  private isInitialized: boolean = false;

  /**
   * Initialize the Photoshop bridge
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if Photoshop APIs are available
      if (!app || !action || !core) {
        throw new Error('Photoshop APIs not available');
      }

      this.isInitialized = true;
      console.log('Photoshop bridge initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Photoshop bridge:', error);
      return false;
    }
  }

  /**
   * Execute batchPlay command with error handling
   */
  async executeBatchPlay(
    descriptors: ActionDescriptor[],
    options: BatchPlayOptions = {}
  ): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('Photoshop bridge not initialized');
    }

    try {
      const defaultOptions: BatchPlayOptions = {
        synchronousExecution: false,
        continueOnError: false,
        immediateRedraw: false,
        modalBehavior: 'execute',
        ...options,
      };

      const result = await action.batchPlay(descriptors, defaultOptions);
      
      // Check for errors in the result
      if (result && result.length > 0) {
        for (const item of result) {
          if (item._obj === 'error') {
            throw new Error(`Photoshop error: ${item.message} (Code: ${item.result})`);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('BatchPlay execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute command in modal context
   */
  async executeAsModal<T>(
    command: () => Promise<T>,
    commandName: string
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Photoshop bridge not initialized');
    }

    try {
      return await core.executeAsModal(command, { commandName });
    } catch (error) {
      console.error(`Modal execution failed for "${commandName}":`, error);
      throw error;
    }
  }

  /**
   * Get active document information
   */
  async getActiveDocument(): Promise<DocumentInfo | null> {
    try {
      if (!app.activeDocument) {
        return null;
      }

      const doc = app.activeDocument;
      return {
        id: doc.id,
        name: doc.title,
        width: doc.width,
        height: doc.height,
        resolution: doc.resolution,
        colorMode: doc.mode,
        layerCount: doc.layers.length,
      };
    } catch (error) {
      console.error('Failed to get active document:', error);
      return null;
    }
  }

  /**
   * Get selected layers
   */
  async getSelectedLayers(): Promise<LayerInfo[]> {
    try {
      const result = await this.executeBatchPlay([
        {
          _obj: 'get',
          _target: [
            { _property: 'targetLayers' },
            { _ref: 'document', _enum: 'ordinal', _value: 'targetEnum' },
          ],
        },
      ]);

      if (result && result[0] && result[0].targetLayers) {
        return this.parseLayerInfo(result[0].targetLayers);
      }

      return [];
    } catch (error) {
      console.error('Failed to get selected layers:', error);
      return [];
    }
  }

  /**
   * Create a new layer group
   */
  async createLayerGroup(name: string, layerIds?: number[]): Promise<number> {
    const descriptor: ActionDescriptor = {
      _obj: 'make',
      _target: [{ _ref: 'layerSection' }],
      name: name,
    };

    if (layerIds && layerIds.length > 0) {
      descriptor.layerID = layerIds.map(id => ({ _ref: 'layer', _id: id }));
    }

    const result = await this.executeAsModal(async () => {
      return await this.executeBatchPlay([descriptor]);
    }, 'Create Layer Group');

    // Extract the new group ID from the result
    if (result && result[0] && result[0].layerSectionStart) {
      return result[0].layerSectionStart;
    }

    throw new Error('Failed to create layer group');
  }

  /**
   * Set layer visibility
   */
  async setLayerVisibility(layerId: number, visible: boolean): Promise<void> {
    const command = visible ? 'show' : 'hide';
    
    await this.executeAsModal(async () => {
      return await this.executeBatchPlay([
        {
          _obj: command,
          _target: [{ _ref: 'layer', _id: layerId }],
        },
      ]);
    }, `${visible ? 'Show' : 'Hide'} Layer`);
  }

  /**
   * Rename a layer
   */
  async renameLayer(layerId: number, newName: string): Promise<void> {
    await this.executeAsModal(async () => {
      return await this.executeBatchPlay([
        {
          _obj: 'set',
          _target: [{ _ref: 'layer', _id: layerId }],
          to: { _obj: 'layer', name: newName },
        },
      ]);
    }, 'Rename Layer');
  }

  /**
   * Apply color to text layers
   */
  async applyTextColor(layerIds: number[], color: { r: number; g: number; b: number }): Promise<void> {
    const commands = layerIds.map(layerId => ({
      _obj: 'set',
      _target: [{ _ref: 'textLayer', _id: layerId }],
      to: {
        _obj: 'textLayer',
        textStyleRange: [
          {
            _obj: 'textStyleRange',
            from: 0,
            to: -1,
            textStyle: {
              _obj: 'textStyle',
              color: {
                _obj: 'RGBColor',
                red: color.r,
                green: color.g,
                blue: color.b,
              },
            },
          },
        ],
      },
    }));

    await this.executeAsModal(async () => {
      return await this.executeBatchPlay(commands);
    }, 'Apply Text Color');
  }

  /**
   * Apply color to shape layers
   */
  async applyShapeColor(layerIds: number[], color: { r: number; g: number; b: number }): Promise<void> {
    const commands = layerIds.map(layerId => ({
      _obj: 'set',
      _target: [{ _ref: 'contentLayer', _id: layerId }],
      to: {
        _obj: 'solidColorLayer',
        color: {
          _obj: 'RGBColor',
          red: color.r,
          green: color.g,
          blue: color.b,
        },
      },
    }));

    await this.executeAsModal(async () => {
      return await this.executeBatchPlay(commands);
    }, 'Apply Shape Color');
  }

  /**
   * Apply font to text layers
   */
  async applyFont(layerIds: number[], fontName: string): Promise<void> {
    const commands = layerIds.map(layerId => ({
      _obj: 'set',
      _target: [{ _ref: 'textLayer', _id: layerId }],
      to: {
        _obj: 'textLayer',
        textStyleRange: [
          {
            _obj: 'textStyleRange',
            from: 0,
            to: -1,
            textStyle: {
              _obj: 'textStyle',
              fontPostScriptName: fontName,
            },
          },
        ],
      },
    }));

    await this.executeAsModal(async () => {
      return await this.executeBatchPlay(commands);
    }, 'Apply Font');
  }

  /**
   * Apply stroke effect to layers
   */
  async applyStrokeEffect(
    layerIds: number[],
    strokeWidth: number,
    strokeColor: { r: number; g: number; b: number }
  ): Promise<void> {
    const commands = layerIds.map(layerId => ({
      _obj: 'applyStyle',
      _target: [{ _ref: 'layer', _id: layerId }],
      using: {
        _obj: 'layerEffects',
        frameFX: {
          _obj: 'frameFX',
          enabled: true,
          style: { _enum: 'frameStyle', _value: 'outsetFrame' },
          paintType: { _enum: 'frameFill', _value: 'solidColor' },
          mode: { _enum: 'blendMode', _value: 'normal' },
          opacity: { _unit: 'percentUnit', _value: 100 },
          size: { _unit: 'pixelsUnit', _value: strokeWidth },
          color: {
            _obj: 'RGBColor',
            red: strokeColor.r,
            green: strokeColor.g,
            blue: strokeColor.b,
          },
        },
      },
    }));

    await this.executeAsModal(async () => {
      return await this.executeBatchPlay(commands);
    }, 'Apply Stroke Effect');
  }

  /**
   * Replace image content in a layer
   */
  async replaceImageContent(layerId: number, imagePath: string): Promise<void> {
    await this.executeAsModal(async () => {
      return await this.executeBatchPlay([
        {
          _obj: 'placeEvent',
          _target: [{ _ref: 'layer', _id: layerId }],
          null: {
            _path: imagePath,
            _kind: 'local',
          },
          freeTransformCenterState: {
            _enum: 'quadCenterState',
            _value: 'QCSAverage',
          },
          offset: {
            _obj: 'offset',
            horizontal: { _unit: 'pixelsUnit', _value: 0 },
            vertical: { _unit: 'pixelsUnit', _value: 0 },
          },
        },
      ]);
    }, 'Replace Image Content');
  }

  /**
   * Get layer properties using multiGet for efficiency
   */
  async getLayerProperties(layerIds: number[], properties: string[]): Promise<any[]> {
    const commands = layerIds.map(layerId => ({
      _obj: 'multiGet',
      _target: [{ _ref: 'layer', _id: layerId }],
      extendedReference: [properties],
      options: {
        failOnMissingProperty: false,
        failOnMissingElement: false,
      },
    }));

    const result = await this.executeBatchPlay(commands);
    return result || [];
  }

  /**
   * Move layer to different position
   */
  async moveLayer(
    layerId: number,
    targetLayerId: number,
    position: 'before' | 'after' | 'inside'
  ): Promise<void> {
    const placement = {
      before: 'placeBefore',
      after: 'placeAfter', 
      inside: 'placeInside',
    }[position];

    await this.executeAsModal(async () => {
      return await this.executeBatchPlay([
        {
          _obj: 'move',
          _target: [{ _ref: 'layer', _id: layerId }],
          to: [{ _ref: 'layer', _id: targetLayerId }],
          adjustment: { _enum: 'adjustment', _value: placement },
        },
      ]);
    }, 'Move Layer');
  }

  /**
   * Duplicate layer
   */
  async duplicateLayer(layerId: number, newName?: string): Promise<number> {
    const descriptor: ActionDescriptor = {
      _obj: 'duplicate',
      _target: [{ _ref: 'layer', _id: layerId }],
    };

    if (newName) {
      descriptor.name = newName;
    }

    const result = await this.executeAsModal(async () => {
      return await this.executeBatchPlay([descriptor]);
    }, 'Duplicate Layer');

    if (result && result[0] && result[0].layerID) {
      return result[0].layerID;
    }

    throw new Error('Failed to duplicate layer');
  }

  /**
   * Delete layer
   */
  async deleteLayer(layerId: number): Promise<void> {
    await this.executeAsModal(async () => {
      return await this.executeBatchPlay([
        {
          _obj: 'delete',
          _target: [{ _ref: 'layer', _id: layerId }],
        },
      ]);
    }, 'Delete Layer');
  }

  // Private helper methods

  private parseLayerInfo(layerData: any[]): LayerInfo[] {
    return layerData.map(layer => ({
      id: layer.layerID || layer.id,
      name: layer.name || 'Unnamed Layer',
      kind: layer.layerKind || layer.kind || 'unknown',
      visible: layer.visible !== false,
      opacity: layer.opacity || 100,
      bounds: {
        left: layer.bounds?.left || 0,
        top: layer.bounds?.top || 0,
        right: layer.bounds?.right || 0,
        bottom: layer.bounds?.bottom || 0,
      },
    }));
  }
}

// Export singleton instance
export const photoshopBridge = new PhotoshopBridge();

// Export types for external use
export type {
  ActionDescriptor,
  ActionReference,
  BatchPlayOptions,
  LayerInfo,
  DocumentInfo,
};