/**
 * Layer Inspector Module
 * Analyzes layer properties and content for intelligent grouping and operations
 */

import { photoshopBridge, LayerInfo } from './photoshop-bridge';

interface LayerAnalysis {
  id: number;
  name: string;
  type: LayerType;
  contentType: ContentType;
  spatialInfo: SpatialInfo;
  styleInfo: StyleInfo;
  semanticInfo: SemanticInfo;
}

interface SpatialInfo {
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  center: {
    x: number;
    y: number;
  };
  area: number;
  aspectRatio: number;
}

interface StyleInfo {
  hasText: boolean;
  hasShape: boolean;
  hasImage: boolean;
  hasEffects: boolean;
  color?: {
    r: number;
    g: number;
    b: number;
  };
  font?: string;
  fontSize?: number;
}

interface SemanticInfo {
  nameTokens: string[];
  category: string;
  confidence: number;
  tags: string[];
}

enum LayerType {
  TEXT = 'text',
  SHAPE = 'shape',
  IMAGE = 'image',
  GROUP = 'group',
  ADJUSTMENT = 'adjustment',
  SMART_OBJECT = 'smartObject',
  UNKNOWN = 'unknown',
}

enum ContentType {
  UI_ELEMENT = 'ui_element',
  ICON = 'icon',
  BUTTON = 'button',
  TEXT_BLOCK = 'text_block',
  IMAGE_CONTENT = 'image_content',
  BACKGROUND = 'background',
  DECORATION = 'decoration',
  UNKNOWN = 'unknown',
}

class LayerInspector {
  private analysisCache: Map<number, LayerAnalysis> = new Map();
  private documentCache: Map<number, LayerAnalysis[]> = new Map();

  /**
   * Analyze a single layer comprehensively
   */
  async analyzeLayer(layerId: number): Promise<LayerAnalysis> {
    // Check cache first
    if (this.analysisCache.has(layerId)) {
      return this.analysisCache.get(layerId)!;
    }

    try {
      // Get layer properties from Photoshop
      const properties = await photoshopBridge.getLayerProperties(
        [layerId],
        ['name', 'layerKind', 'bounds', 'visible', 'opacity', 'textKey', 'color']
      );

      if (!properties || properties.length === 0) {
        throw new Error(`Failed to get properties for layer ${layerId}`);
      }

      const layerData = properties[0];
      const analysis = await this.performLayerAnalysis(layerId, layerData);

      // Cache the result
      this.analysisCache.set(layerId, analysis);
      return analysis;
    } catch (error) {
      console.error(`Failed to analyze layer ${layerId}:`, error);
      
      // Return minimal analysis on error
      return {
        id: layerId,
        name: `Layer ${layerId}`,
        type: LayerType.UNKNOWN,
        contentType: ContentType.UNKNOWN,
        spatialInfo: this.getDefaultSpatialInfo(),
        styleInfo: this.getDefaultStyleInfo(),
        semanticInfo: this.getDefaultSemanticInfo(),
      };
    }
  }

  /**
   * Analyze multiple layers efficiently
   */
  async analyzeLayers(layerIds: number[]): Promise<LayerAnalysis[]> {
    const uncachedIds = layerIds.filter(id => !this.analysisCache.has(id));
    
    if (uncachedIds.length > 0) {
      // Batch analyze uncached layers
      await this.batchAnalyzeLayers(uncachedIds);
    }

    // Return all requested analyses from cache
    return layerIds.map(id => this.analysisCache.get(id)!).filter(Boolean);
  }

  /**
   * Analyze all layers in the active document
   */
  async analyzeDocument(): Promise<LayerAnalysis[]> {
    try {
      const doc = await photoshopBridge.getActiveDocument();
      if (!doc) {
        throw new Error('No active document');
      }

      // Check document cache
      if (this.documentCache.has(doc.id)) {
        return this.documentCache.get(doc.id)!;
      }

      // Get all layers in the document
      const selectedLayers = await photoshopBridge.getSelectedLayers();
      const layerIds = selectedLayers.map(layer => layer.id);

      const analyses = await this.analyzeLayers(layerIds);
      
      // Cache document analysis
      this.documentCache.set(doc.id, analyses);
      return analyses;
    } catch (error) {
      console.error('Failed to analyze document:', error);
      return [];
    }
  }

  /**
   * Find layers by content type
   */
  async findLayersByContentType(contentType: ContentType): Promise<LayerAnalysis[]> {
    const allLayers = await this.analyzeDocument();
    return allLayers.filter(layer => layer.contentType === contentType);
  }

  /**
   * Find layers by spatial proximity
   */
  async findLayersByProximity(
    referenceLayerId: number,
    maxDistance: number = 100
  ): Promise<LayerAnalysis[]> {
    const allLayers = await this.analyzeDocument();
    const referenceLayer = allLayers.find(layer => layer.id === referenceLayerId);
    
    if (!referenceLayer) {
      return [];
    }

    return allLayers.filter(layer => {
      if (layer.id === referenceLayerId) return false;
      
      const distance = this.calculateDistance(
        referenceLayer.spatialInfo.center,
        layer.spatialInfo.center
      );
      
      return distance <= maxDistance;
    });
  }

  /**
   * Find layers with similar names
   */
  async findLayersBySimilarNames(
    referenceLayerId: number,
    threshold: number = 0.6
  ): Promise<LayerAnalysis[]> {
    const allLayers = await this.analyzeDocument();
    const referenceLayer = allLayers.find(layer => layer.id === referenceLayerId);
    
    if (!referenceLayer) {
      return [];
    }

    return allLayers.filter(layer => {
      if (layer.id === referenceLayerId) return false;
      
      const similarity = this.calculateNameSimilarity(
        referenceLayer.semanticInfo.nameTokens,
        layer.semanticInfo.nameTokens
      );
      
      return similarity >= threshold;
    });
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.documentCache.clear();
  }

  // Private methods

  private async batchAnalyzeLayers(layerIds: number[]): Promise<void> {
    try {
      // Get properties for all layers in batch
      const properties = await photoshopBridge.getLayerProperties(
        layerIds,
        ['name', 'layerKind', 'bounds', 'visible', 'opacity', 'textKey', 'color']
      );

      // Analyze each layer
      for (let i = 0; i < layerIds.length; i++) {
        const layerId = layerIds[i];
        const layerData = properties[i] || {};
        
        const analysis = await this.performLayerAnalysis(layerId, layerData);
        this.analysisCache.set(layerId, analysis);
      }
    } catch (error) {
      console.error('Batch layer analysis failed:', error);
      
      // Fallback to individual analysis
      for (const layerId of layerIds) {
        try {
          await this.analyzeLayer(layerId);
        } catch (individualError) {
          console.error(`Individual analysis failed for layer ${layerId}:`, individualError);
        }
      }
    }
  }

  private async performLayerAnalysis(layerId: number, layerData: any): Promise<LayerAnalysis> {
    const name = layerData.name || `Layer ${layerId}`;
    const layerKind = layerData.layerKind || 'unknown';
    
    // Determine layer type
    const type = this.determineLayerType(layerKind);
    
    // Analyze spatial information
    const spatialInfo = this.analyzeSpatialInfo(layerData.bounds);
    
    // Analyze style information
    const styleInfo = await this.analyzeStyleInfo(layerId, layerData, type);
    
    // Analyze semantic information
    const semanticInfo = this.analyzeSemanticInfo(name, type);
    
    // Determine content type based on all analysis
    const contentType = this.determineContentType(type, styleInfo, semanticInfo, spatialInfo);

    return {
      id: layerId,
      name,
      type,
      contentType,
      spatialInfo,
      styleInfo,
      semanticInfo,
    };
  }

  private determineLayerType(layerKind: string): LayerType {
    const kindMap: Record<string, LayerType> = {
      text: LayerType.TEXT,
      shape: LayerType.SHAPE,
      pixel: LayerType.IMAGE,
      group: LayerType.GROUP,
      adjustment: LayerType.ADJUSTMENT,
      smartObject: LayerType.SMART_OBJECT,
    };

    return kindMap[layerKind] || LayerType.UNKNOWN;
  }

  private analyzeSpatialInfo(bounds: any): SpatialInfo {
    const left = bounds?.left || 0;
    const top = bounds?.top || 0;
    const right = bounds?.right || 0;
    const bottom = bounds?.bottom || 0;
    
    const width = right - left;
    const height = bottom - top;
    const area = width * height;
    const aspectRatio = height > 0 ? width / height : 1;
    
    return {
      bounds: { left, top, right, bottom },
      center: {
        x: left + width / 2,
        y: top + height / 2,
      },
      area,
      aspectRatio,
    };
  }

  private async analyzeStyleInfo(layerId: number, layerData: any, type: LayerType): Promise<StyleInfo> {
    const styleInfo: StyleInfo = {
      hasText: type === LayerType.TEXT,
      hasShape: type === LayerType.SHAPE,
      hasImage: type === LayerType.IMAGE,
      hasEffects: false, // Would need additional API calls to determine
    };

    // Extract color information if available
    if (layerData.color) {
      styleInfo.color = {
        r: layerData.color.red || 0,
        g: layerData.color.green || 0,
        b: layerData.color.blue || 0,
      };
    }

    // Extract text information if it's a text layer
    if (type === LayerType.TEXT && layerData.textKey) {
      // Would need additional API calls to get font information
      styleInfo.font = 'Unknown';
      styleInfo.fontSize = 12; // Default
    }

    return styleInfo;
  }

  private analyzeSemanticInfo(name: string, type: LayerType): SemanticInfo {
    // Tokenize the layer name
    const nameTokens = this.tokenizeName(name);
    
    // Determine category based on name and type
    const category = this.categorizeLayer(nameTokens, type);
    
    // Generate tags
    const tags = this.generateTags(nameTokens, type, category);
    
    // Calculate confidence based on name clarity and type consistency
    const confidence = this.calculateSemanticConfidence(nameTokens, type, category);

    return {
      nameTokens,
      category,
      confidence,
      tags,
    };
  }

  private determineContentType(
    type: LayerType,
    styleInfo: StyleInfo,
    semanticInfo: SemanticInfo,
    spatialInfo: SpatialInfo
  ): ContentType {
    // Use semantic analysis first
    const semanticType = this.getContentTypeFromSemantics(semanticInfo);
    if (semanticType !== ContentType.UNKNOWN) {
      return semanticType;
    }

    // Fallback to type-based determination
    const typeMap: Record<LayerType, ContentType> = {
      [LayerType.TEXT]: ContentType.TEXT_BLOCK,
      [LayerType.SHAPE]: ContentType.UI_ELEMENT,
      [LayerType.IMAGE]: ContentType.IMAGE_CONTENT,
      [LayerType.GROUP]: ContentType.UI_ELEMENT,
      [LayerType.ADJUSTMENT]: ContentType.DECORATION,
      [LayerType.SMART_OBJECT]: ContentType.IMAGE_CONTENT,
      [LayerType.UNKNOWN]: ContentType.UNKNOWN,
    };

    return typeMap[type] || ContentType.UNKNOWN;
  }

  private tokenizeName(name: string): string[] {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private categorizeLayer(tokens: string[], type: LayerType): string {
    const categories = {
      ui: ['button', 'menu', 'nav', 'header', 'footer', 'sidebar'],
      icon: ['icon', 'ico', 'symbol', 'logo'],
      text: ['title', 'heading', 'label', 'text', 'copy'],
      image: ['photo', 'image', 'img', 'picture', 'bg', 'background'],
      decoration: ['border', 'shadow', 'glow', 'effect'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (tokens.some(token => keywords.includes(token))) {
        return category;
      }
    }

    return 'general';
  }

  private generateTags(tokens: string[], type: LayerType, category: string): string[] {
    const tags = [...tokens];
    tags.push(type);
    tags.push(category);
    
    // Add contextual tags based on patterns
    if (tokens.some(token => ['btn', 'button'].includes(token))) {
      tags.push('interactive');
    }
    
    if (tokens.some(token => ['bg', 'background'].includes(token))) {
      tags.push('background');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private calculateSemanticConfidence(tokens: string[], type: LayerType, category: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for descriptive names
    if (tokens.length > 1) {
      confidence += 0.2;
    }

    // Increase confidence for consistent type and category
    const typeConsistency = this.checkTypeConsistency(type, category);
    confidence += typeConsistency * 0.3;

    return Math.min(confidence, 1.0);
  }

  private checkTypeConsistency(type: LayerType, category: string): number {
    const consistencyMap: Record<string, LayerType[]> = {
      text: [LayerType.TEXT],
      icon: [LayerType.SHAPE, LayerType.IMAGE],
      ui: [LayerType.SHAPE, LayerType.GROUP],
      image: [LayerType.IMAGE, LayerType.SMART_OBJECT],
    };

    const expectedTypes = consistencyMap[category] || [];
    return expectedTypes.includes(type) ? 1.0 : 0.0;
  }

  private getContentTypeFromSemantics(semanticInfo: SemanticInfo): ContentType {
    const categoryMap: Record<string, ContentType> = {
      ui: ContentType.UI_ELEMENT,
      icon: ContentType.ICON,
      text: ContentType.TEXT_BLOCK,
      image: ContentType.IMAGE_CONTENT,
      decoration: ContentType.DECORATION,
    };

    return categoryMap[semanticInfo.category] || ContentType.UNKNOWN;
  }

  private calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateNameSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(token => set2.has(token)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private getDefaultSpatialInfo(): SpatialInfo {
    return {
      bounds: { left: 0, top: 0, right: 0, bottom: 0 },
      center: { x: 0, y: 0 },
      area: 0,
      aspectRatio: 1,
    };
  }

  private getDefaultStyleInfo(): StyleInfo {
    return {
      hasText: false,
      hasShape: false,
      hasImage: false,
      hasEffects: false,
    };
  }

  private getDefaultSemanticInfo(): SemanticInfo {
    return {
      nameTokens: [],
      category: 'unknown',
      confidence: 0,
      tags: [],
    };
  }
}

// Export singleton instance
export const layerInspector = new LayerInspector();

// Export types for external use
export type {
  LayerAnalysis,
  SpatialInfo,
  StyleInfo,
  SemanticInfo,
};

export { LayerType, ContentType };