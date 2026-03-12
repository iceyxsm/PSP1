/**
 * Style Manager Component
 * Handles bulk styling operations for colors, fonts, and effects
 */

import { photoshopBridge } from './photoshop-bridge';
import { layerInspector, LayerType } from './layer-inspector';
import { commandDispatcher } from './command-dispatcher';
import { stateManager } from './state-manager';

interface ColorInfo {
  r: number;
  g: number;
  b: number;
  hex: string;
  hsl?: { h: number; s: number; l: number };
}

interface ColorHarmony {
  complementary: ColorInfo[];
  analogous: ColorInfo[];
  triadic: ColorInfo[];
  tetradic: ColorInfo[];
}

interface StyleOperation {
  layerIds: number[];
  operation: 'color' | 'font' | 'effect';
  parameters: any;
  preserveProperties: string[];
}

class StyleManager {
  /**
   * Apply color to text layers with property preservation
   */
  async applyTextColor(
    layerIds: number[],
    color: ColorInfo,
    preserveFormatting: boolean = true
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    try {
      // Filter to only text layers
      const analyses = await layerInspector.analyzeLayers(layerIds);
      const textLayerIds = analyses
        .filter(a => a.type === LayerType.TEXT)
        .map(a => a.id);

      if (textLayerIds.length === 0) {
        return { success: false, affectedLayers: [] };
      }

      // Apply color
      const result = await commandDispatcher.executeCommand(
        'applyTextColor',
        textLayerIds,
        { r: color.r, g: color.g, b: color.b }
      );

      if (result.success) {
        // Add to recent colors
        stateManager.addRecentColor(color.hex);
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        affectedLayers: textLayerIds,
      };
    } catch (error) {
      console.error('Failed to apply text color:', error);
      return { success: false, affectedLayers: [] };
    }
  }

  /**
   * Apply color to shape layers
   */
  async applyShapeColor(
    layerIds: number[],
    color: ColorInfo,
    applyToFill: boolean = true,
    applyToStroke: boolean = false
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    try {
      // Filter to only shape layers
      const analyses = await layerInspector.analyzeLayers(layerIds);
      const shapeLayerIds = analyses
        .filter(a => a.type === LayerType.SHAPE)
        .map(a => a.id);

      if (shapeLayerIds.length === 0) {
        return { success: false, affectedLayers: [] };
      }

      // Apply color
      const result = await commandDispatcher.executeCommand(
        'applyShapeColor',
        shapeLayerIds,
        { r: color.r, g: color.g, b: color.b }
      );

      if (result.success) {
        stateManager.addRecentColor(color.hex);
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        affectedLayers: shapeLayerIds,
      };
    } catch (error) {
      console.error('Failed to apply shape color:', error);
      return { success: false, affectedLayers: [] };
    }
  }

  /**
   * Apply font to text layers
   */
  async applyFont(
    layerIds: number[],
    fontName: string,
    preserveSize: boolean = true
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    try {
      // Filter to only text layers
      const analyses = await layerInspector.analyzeLayers(layerIds);
      const textLayerIds = analyses
        .filter(a => a.type === LayerType.TEXT)
        .map(a => a.id);

      if (textLayerIds.length === 0) {
        return { success: false, affectedLayers: [] };
      }

      // Apply font
      const result = await commandDispatcher.executeCommand(
        'applyFont',
        textLayerIds,
        fontName
      );

      if (result.success) {
        stateManager.addRecentFont(fontName);
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        affectedLayers: textLayerIds,
      };
    } catch (error) {
      console.error('Failed to apply font:', error);
      return { success: false, affectedLayers: [] };
    }
  }

  /**
   * Search available fonts
   */
  async searchFonts(query: string): Promise<string[]> {
    try {
      const result = await commandDispatcher.executeCommand('getFontList');
      if (!result.success || !result.data) {
        return [];
      }

      const fonts = result.data as string[];
      const lowerQuery = query.toLowerCase();
      
      return fonts.filter(font => 
        font.toLowerCase().includes(lowerQuery)
      ).slice(0, 20); // Limit to 20 results
    } catch (error) {
      console.error('Failed to search fonts:', error);
      return [];
    }
  }

  /**
   * Get font substitution suggestions
   */
  async getFontSubstitutions(missingFont: string): Promise<string[]> {
    try {
      const result = await commandDispatcher.executeCommand('getFontList');
      if (!result.success || !result.data) {
        return [];
      }

      const fonts = result.data as string[];
      const suggestions: string[] = [];

      // Simple similarity matching based on font family
      const missingFamily = missingFont.split('-')[0].toLowerCase();
      
      for (const font of fonts) {
        const fontFamily = font.split('-')[0].toLowerCase();
        if (fontFamily.includes(missingFamily) || missingFamily.includes(fontFamily)) {
          suggestions.push(font);
        }
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      console.error('Failed to get font substitutions:', error);
      return [];
    }
  }

  /**
   * Apply stroke effect to layers
   */
  async applyStrokeEffect(
    layerIds: number[],
    strokeWidth: number,
    strokeColor: ColorInfo,
    position: 'inside' | 'outside' | 'center' = 'outside'
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    try {
      const result = await commandDispatcher.executeCommand(
        'applyStrokeEffect',
        layerIds,
        strokeWidth,
        { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b }
      );

      if (result.success) {
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        affectedLayers: layerIds,
      };
    } catch (error) {
      console.error('Failed to apply stroke effect:', error);
      return { success: false, affectedLayers: [] };
    }
  }

  /**
   * Apply outline effect with preset styles
   */
  async applyOutlinePreset(
    layerIds: number[],
    presetName: 'thin' | 'medium' | 'thick' | 'custom',
    customWidth?: number,
    customColor?: ColorInfo
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    const presets = {
      thin: { width: 1, color: { r: 0, g: 0, b: 0, hex: '#000000' } },
      medium: { width: 3, color: { r: 0, g: 0, b: 0, hex: '#000000' } },
      thick: { width: 6, color: { r: 0, g: 0, b: 0, hex: '#000000' } },
    };

    let width: number;
    let color: ColorInfo;

    if (presetName === 'custom') {
      width = customWidth || 2;
      color = customColor || { r: 0, g: 0, b: 0, hex: '#000000' };
    } else {
      const preset = presets[presetName];
      width = preset.width;
      color = preset.color;
    }

    return this.applyStrokeEffect(layerIds, width, color, 'outside');
  }

  /**
   * Detect and preserve existing layer effects
   */
  async preserveLayerEffects(
    layerId: number
  ): Promise<{ effects: any; success: boolean }> {
    try {
      const result = await commandDispatcher.executeCommand('getLayerEffects', layerId);
      
      return {
        effects: result.data || {},
        success: result.success,
      };
    } catch (error) {
      console.error('Failed to preserve layer effects:', error);
      return { effects: {}, success: false };
    }
  }

  /**
   * Apply layer effects while preserving existing ones
   */
  async applyEffectsWithPreservation(
    layerId: number,
    newEffects: any
  ): Promise<{ success: boolean }> {
    try {
      // Get existing effects
      const existing = await this.preserveLayerEffects(layerId);
      
      // Merge with new effects
      const mergedEffects = { ...existing.effects, ...newEffects };
      
      // Apply merged effects
      const result = await commandDispatcher.executeCommand(
        'setLayerEffects',
        layerId,
        mergedEffects
      );

      return { success: result.success };
    } catch (error) {
      console.error('Failed to apply effects with preservation:', error);
      return { success: false };
    }
  }

  /**
   * Generate color harmony suggestions
   */
  generateColorHarmony(baseColor: ColorInfo): ColorHarmony {
    const hsl = this.rgbToHsl(baseColor.r, baseColor.g, baseColor.b);

    return {
      complementary: this.generateComplementary(hsl),
      analogous: this.generateAnalogous(hsl),
      triadic: this.generateTriadic(hsl),
      tetradic: this.generateTetradic(hsl),
    };
  }

  /**
   * Detect shape properties (fill, stroke, gradient)
   */
  async detectShapeProperties(
    layerId: number
  ): Promise<{
    hasFill: boolean;
    hasStroke: boolean;
    hasGradient: boolean;
    fillColor?: ColorInfo;
    strokeColor?: ColorInfo;
    strokeWidth?: number;
  }> {
    try {
      const result = await commandDispatcher.executeCommand('getShapeProperties', layerId);
      
      if (!result.success || !result.data) {
        return { hasFill: false, hasStroke: false, hasGradient: false };
      }

      const props = result.data;
      return {
        hasFill: !!props.fillColor,
        hasStroke: !!props.strokeColor,
        hasGradient: !!props.gradient,
        fillColor: props.fillColor,
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
      };
    } catch (error) {
      console.error('Failed to detect shape properties:', error);
      return { hasFill: false, hasStroke: false, hasGradient: false };
    }
  }

  /**
   * Apply selective property modifications to shapes
   */
  async modifyShapeProperty(
    layerIds: number[],
    property: 'fill' | 'stroke' | 'strokeWidth',
    value: ColorInfo | number
  ): Promise<{ success: boolean; affectedLayers: number[] }> {
    try {
      const analyses = await layerInspector.analyzeLayers(layerIds);
      const shapeLayerIds = analyses
        .filter(a => a.type === LayerType.SHAPE)
        .map(a => a.id);

      if (shapeLayerIds.length === 0) {
        return { success: false, affectedLayers: [] };
      }

      const result = await commandDispatcher.executeCommand(
        'modifyShapeProperty',
        shapeLayerIds,
        property,
        value
      );

      if (result.success) {
        stateManager.incrementOperationCount();
      }

      return {
        success: result.success,
        affectedLayers: shapeLayerIds,
      };
    } catch (error) {
      console.error('Failed to modify shape property:', error);
      return { success: false, affectedLayers: [] };
    }
  }

  /**
   * Preserve gradient during color changes
   */
  async applyColorWithGradientPreservation(
    layerId: number,
    newColor: ColorInfo
  ): Promise<{ success: boolean }> {
    try {
      // Detect if layer has gradient
      const props = await this.detectShapeProperties(layerId);
      
      if (!props.hasGradient) {
        // No gradient, apply color normally
        return this.applyShapeColor([layerId], newColor);
      }

      // Has gradient - preserve gradient structure, update colors
      const result = await commandDispatcher.executeCommand(
        'updateGradientColors',
        layerId,
        newColor
      );

      return { success: result.success };
    } catch (error) {
      console.error('Failed to apply color with gradient preservation:', error);
      return { success: false };
    }
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex: string): ColorInfo {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { r: 0, g: 0, b: 0, hex: '#000000' };
    }

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return {
      r,
      g,
      b,
      hex: hex.startsWith('#') ? hex : `#${hex}`,
      hsl: this.rgbToHsl(r, g, b),
    };
  }

  /**
   * Convert RGB to hex
   */
  rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convert RGB to HSL
   */
  rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Convert HSL to RGB
   */
  hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  // Private methods for color harmony

  private generateComplementary(hsl: { h: number; s: number; l: number }): ColorInfo[] {
    const complementHue = (hsl.h + 180) % 360;
    const rgb = this.hslToRgb(complementHue, hsl.s, hsl.l);
    
    return [
      {
        ...rgb,
        hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
        hsl: { h: complementHue, s: hsl.s, l: hsl.l },
      },
    ];
  }

  private generateAnalogous(hsl: { h: number; s: number; l: number }): ColorInfo[] {
    const colors: ColorInfo[] = [];
    const offsets = [-30, 30];

    for (const offset of offsets) {
      const newHue = (hsl.h + offset + 360) % 360;
      const rgb = this.hslToRgb(newHue, hsl.s, hsl.l);
      colors.push({
        ...rgb,
        hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
        hsl: { h: newHue, s: hsl.s, l: hsl.l },
      });
    }

    return colors;
  }

  private generateTriadic(hsl: { h: number; s: number; l: number }): ColorInfo[] {
    const colors: ColorInfo[] = [];
    const offsets = [120, 240];

    for (const offset of offsets) {
      const newHue = (hsl.h + offset) % 360;
      const rgb = this.hslToRgb(newHue, hsl.s, hsl.l);
      colors.push({
        ...rgb,
        hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
        hsl: { h: newHue, s: hsl.s, l: hsl.l },
      });
    }

    return colors;
  }

  private generateTetradic(hsl: { h: number; s: number; l: number }): ColorInfo[] {
    const colors: ColorInfo[] = [];
    const offsets = [90, 180, 270];

    for (const offset of offsets) {
      const newHue = (hsl.h + offset) % 360;
      const rgb = this.hslToRgb(newHue, hsl.s, hsl.l);
      colors.push({
        ...rgb,
        hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
        hsl: { h: newHue, s: hsl.s, l: hsl.l },
      });
    }

    return colors;
  }
}

// Export singleton instance
export const styleManager = new StyleManager();

// Export types
export type { ColorInfo, ColorHarmony, StyleOperation };