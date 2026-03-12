/**
 * Image Replacer Component
 * Handles tap-to-replace image workflow with automatic dimension matching
 */

import { photoshopBridge } from './photoshop-bridge';
import { commandDispatcher } from './command-dispatcher';
import { stateManager } from './state-manager';

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

interface ImagePosition {
  x: number;
  y: number;
}

interface ImageMetadata {
  layerId: number;
  name: string;
  dimensions: ImageDimensions;
  position: ImagePosition;
  opacity: number;
  blendMode: string;
  effects: any;
}

interface ReplacementResult {
  success: boolean;
  layerId?: number;
  originalDimensions?: ImageDimensions;
  newDimensions?: ImageDimensions;
  scaleFactor?: number;
  error?: string;
}

class ImageReplacer {
  private readonly POSITION_TOLERANCE = 2; // ±2 pixels tolerance

  /**
   * Replace image with tap-to-replace workflow
   */
  async replaceImage(
    targetLayerId: number,
    newImagePath: string
  ): Promise<ReplacementResult> {
    try {
      // Step 1: Capture original metadata
      const originalMetadata = await this.captureImageMetadata(targetLayerId);
      
      if (!originalMetadata) {
        return { success: false, error: 'Failed to capture original metadata' };
      }

      // Step 2: Replace image content
      const replaceResult = await this.replaceImageContent(
        targetLayerId,
        newImagePath
      );

      if (!replaceResult.success) {
        return { success: false, error: 'Failed to replace image content' };
      }

      // Step 3: Match dimensions and position
      const matchResult = await this.matchDimensions(
        targetLayerId,
        originalMetadata
      );

      if (!matchResult.success) {
        return { success: false, error: 'Failed to match dimensions' };
      }

      // Step 4: Restore metadata
      await this.restoreMetadata(targetLayerId, originalMetadata);

      stateManager.incrementOperationCount();

      return {
        success: true,
        layerId: targetLayerId,
        originalDimensions: originalMetadata.dimensions,
        newDimensions: matchResult.newDimensions,
        scaleFactor: matchResult.scaleFactor,
      };
    } catch (error) {
      console.error('Failed to replace image:', error);
      return { success: false, error: 'Image replacement failed' };
    }
  }

  /**
   * Capture image metadata before replacement
   */
  private async captureImageMetadata(
    layerId: number
  ): Promise<ImageMetadata | null> {
    try {
      const result = await commandDispatcher.executeCommand(
        'getLayerMetadata',
        layerId
      );

      if (!result.success || !result.data) {
        return null;
      }

      const data = result.data;

      return {
        layerId,
        name: data.name || 'Image',
        dimensions: {
          width: data.width || 0,
          height: data.height || 0,
          aspectRatio: data.width / data.height || 1,
        },
        position: {
          x: data.x || 0,
          y: data.y || 0,
        },
        opacity: data.opacity || 100,
        blendMode: data.blendMode || 'normal',
        effects: data.effects || {},
      };
    } catch (error) {
      console.error('Failed to capture metadata:', error);
      return null;
    }
  }

  /**
   * Replace image content while preserving layer
   */
  private async replaceImageContent(
    layerId: number,
    newImagePath: string
  ): Promise<{ success: boolean }> {
    try {
      const result = await commandDispatcher.executeCommand(
        'replaceImageContent',
        layerId,
        newImagePath
      );

      return { success: result.success };
    } catch (error) {
      console.error('Failed to replace image content:', error);
      return { success: false };
    }
  }

  /**
   * Match dimensions to original with aspect ratio preservation
   */
  private async matchDimensions(
    layerId: number,
    originalMetadata: ImageMetadata
  ): Promise<{
    success: boolean;
    newDimensions?: ImageDimensions;
    scaleFactor?: number;
  }> {
    try {
      // Get new image dimensions
      const currentResult = await commandDispatcher.executeCommand(
        'getLayerDimensions',
        layerId
      );

      if (!currentResult.success || !currentResult.data) {
        return { success: false };
      }

      const currentDimensions = currentResult.data;
      const targetDimensions = originalMetadata.dimensions;

      // Calculate scale factor to match original dimensions
      const scaleX = targetDimensions.width / currentDimensions.width;
      const scaleY = targetDimensions.height / currentDimensions.height;

      // Use the smaller scale to preserve aspect ratio
      const scaleFactor = Math.min(scaleX, scaleY);

      // Calculate new dimensions
      const newWidth = currentDimensions.width * scaleFactor;
      const newHeight = currentDimensions.height * scaleFactor;

      // Apply scaling
      const scaleResult = await commandDispatcher.executeCommand(
        'scaleLayer',
        layerId,
        scaleFactor * 100 // Convert to percentage
      );

      if (!scaleResult.success) {
        return { success: false };
      }

      // Match position with tolerance
      await this.matchPosition(layerId, originalMetadata.position);

      return {
        success: true,
        newDimensions: {
          width: newWidth,
          height: newHeight,
          aspectRatio: newWidth / newHeight,
        },
        scaleFactor,
      };
    } catch (error) {
      console.error('Failed to match dimensions:', error);
      return { success: false };
    }
  }

  /**
   * Match position to original with tolerance
   */
  private async matchPosition(
    layerId: number,
    targetPosition: ImagePosition
  ): Promise<{ success: boolean }> {
    try {
      // Get current position
      const currentResult = await commandDispatcher.executeCommand(
        'getLayerPosition',
        layerId
      );

      if (!currentResult.success || !currentResult.data) {
        return { success: false };
      }

      const currentPosition = currentResult.data;

      // Calculate offset needed
      const offsetX = targetPosition.x - currentPosition.x;
      const offsetY = targetPosition.y - currentPosition.y;

      // Only adjust if outside tolerance
      if (
        Math.abs(offsetX) > this.POSITION_TOLERANCE ||
        Math.abs(offsetY) > this.POSITION_TOLERANCE
      ) {
        const moveResult = await commandDispatcher.executeCommand(
          'moveLayer',
          layerId,
          offsetX,
          offsetY
        );

        return { success: moveResult.success };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to match position:', error);
      return { success: false };
    }
  }

  /**
   * Restore metadata after replacement
   */
  private async restoreMetadata(
    layerId: number,
    metadata: ImageMetadata
  ): Promise<{ success: boolean }> {
    try {
      // Restore opacity
      await commandDispatcher.executeCommand(
        'setLayerOpacity',
        layerId,
        metadata.opacity
      );

      // Restore blend mode
      await commandDispatcher.executeCommand(
        'setLayerBlendMode',
        layerId,
        metadata.blendMode
      );

      // Restore effects if any
      if (metadata.effects && Object.keys(metadata.effects).length > 0) {
        await commandDispatcher.executeCommand(
          'setLayerEffects',
          layerId,
          metadata.effects
        );
      }

      // Restore name
      await commandDispatcher.executeCommand(
        'renameLayer',
        layerId,
        metadata.name
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to restore metadata:', error);
      return { success: false };
    }
  }

  /**
   * Batch replace multiple images
   */
  async batchReplaceImages(
    replacements: Array<{ layerId: number; newImagePath: string }>
  ): Promise<{
    success: boolean;
    results: ReplacementResult[];
    successCount: number;
    failureCount: number;
  }> {
    const results: ReplacementResult[] = [];

    for (const replacement of replacements) {
      const result = await this.replaceImage(
        replacement.layerId,
        replacement.newImagePath
      );
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: successCount > 0,
      results,
      successCount,
      failureCount,
    };
  }

  /**
   * Preview replacement without applying
   */
  async previewReplacement(
    targetLayerId: number,
    newImagePath: string
  ): Promise<{
    success: boolean;
    preview?: {
      originalDimensions: ImageDimensions;
      newDimensions: ImageDimensions;
      scaleFactor: number;
      willFit: boolean;
    };
  }> {
    try {
      // Get original dimensions
      const originalMetadata = await this.captureImageMetadata(targetLayerId);
      
      if (!originalMetadata) {
        return { success: false };
      }

      // Get new image dimensions without replacing
      const newImageInfo = await this.getImageInfo(newImagePath);
      
      if (!newImageInfo) {
        return { success: false };
      }

      // Calculate scale factor
      const scaleX = originalMetadata.dimensions.width / newImageInfo.width;
      const scaleY = originalMetadata.dimensions.height / newImageInfo.height;
      const scaleFactor = Math.min(scaleX, scaleY);

      const newWidth = newImageInfo.width * scaleFactor;
      const newHeight = newImageInfo.height * scaleFactor;

      return {
        success: true,
        preview: {
          originalDimensions: originalMetadata.dimensions,
          newDimensions: {
            width: newWidth,
            height: newHeight,
            aspectRatio: newWidth / newHeight,
          },
          scaleFactor,
          willFit: scaleFactor <= 1.0,
        },
      };
    } catch (error) {
      console.error('Failed to preview replacement:', error);
      return { success: false };
    }
  }

  /**
   * Get image info without loading into document
   */
  private async getImageInfo(
    imagePath: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      const result = await commandDispatcher.executeCommand(
        'getImageInfo',
        imagePath
      );

      if (!result.success || !result.data) {
        return null;
      }

      return {
        width: result.data.width || 0,
        height: result.data.height || 0,
      };
    } catch (error) {
      console.error('Failed to get image info:', error);
      return null;
    }
  }

  /**
   * Validate image file
   */
  validateImageFile(filePath: string): { valid: boolean; error?: string } {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));

    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file type. Supported: ${validExtensions.join(', ')}`,
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const imageReplacer = new ImageReplacer();

// Export types
export type {
  ImageDimensions,
  ImagePosition,
  ImageMetadata,
  ReplacementResult,
};
