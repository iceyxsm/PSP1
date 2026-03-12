/**
 * Auto Grouper Component
 * Intelligent layer grouping with content and spatial analysis
 */

import { photoshopBridge } from './photoshop-bridge';
import { layerInspector, LayerAnalysis, LayerType, ContentType } from './layer-inspector';
import { commandDispatcher } from './command-dispatcher';
import { stateManager } from './state-manager';

interface GroupingSuggestion {
  layers: number[];
  confidence: number;
  reasoning: string;
  suggestedName: string;
  strategy: GroupingStrategy;
}

enum GroupingStrategy {
  CONTENT_SIMILARITY = 'content_similarity',
  SPATIAL_PROXIMITY = 'spatial_proximity',
  NAME_PATTERN = 'name_pattern',
  TYPE_BASED = 'type_based',
  HYBRID = 'hybrid',
}

interface GroupingOptions {
  minConfidence?: number;
  maxSuggestions?: number;
  preferredStrategy?: GroupingStrategy;
  includeExisting?: boolean;
}

class AutoGrouper {
  private readonly DEFAULT_MIN_CONFIDENCE = 0.6;
  private readonly DEFAULT_MAX_SUGGESTIONS = 5;
  private readonly PROXIMITY_THRESHOLD = 150; // pixels

  /**
   * Analyze layers and suggest groupings
   */
  async suggestGroupings(
    layerIds: number[],
    options: GroupingOptions = {}
  ): Promise<GroupingSuggestion[]> {
    const minConfidence = options.minConfidence || this.DEFAULT_MIN_CONFIDENCE;
    const maxSuggestions = options.maxSuggestions || this.DEFAULT_MAX_SUGGESTIONS;

    try {
      // Analyze all layers
      const analyses = await layerInspector.analyzeLayers(layerIds);
      
      if (analyses.length < 2) {
        return [];
      }

      // Generate suggestions using different strategies
      const suggestions: GroupingSuggestion[] = [];

      if (!options.preferredStrategy || options.preferredStrategy === GroupingStrategy.CONTENT_SIMILARITY) {
        suggestions.push(...await this.suggestByContentSimilarity(analyses));
      }

      if (!options.preferredStrategy || options.preferredStrategy === GroupingStrategy.SPATIAL_PROXIMITY) {
        suggestions.push(...await this.suggestBySpatialProximity(analyses));
      }

      if (!options.preferredStrategy || options.preferredStrategy === GroupingStrategy.NAME_PATTERN) {
        suggestions.push(...await this.suggestByNamePattern(analyses));
      }

      if (!options.preferredStrategy || options.preferredStrategy === GroupingStrategy.TYPE_BASED) {
        suggestions.push(...await this.suggestByType(analyses));
      }

      // Filter by confidence and sort
      const filtered = suggestions
        .filter(s => s.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestions);

      return filtered;
    } catch (error) {
      console.error('Failed to suggest groupings:', error);
      return [];
    }
  }

  /**
   * Create a group from selected layers
   */
  async createGroup(
    layerIds: number[],
    name?: string,
    autoName: boolean = true
  ): Promise<{ groupId: number; name: string }> {
    try {
      // Generate name if not provided
      const groupName = name || (autoName ? await this.generateGroupName(layerIds) : 'New Group');

      // Create the group
      const result = await commandDispatcher.executeCommand('createLayerGroup', groupName, layerIds);

      if (!result.success) {
        throw new Error(result.message || 'Failed to create group');
      }

      // Update state
      stateManager.incrementOperationCount();

      return {
        groupId: result.data.groupId,
        name: groupName,
      };
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  /**
   * Generate intelligent group name based on layer content
   */
  async generateGroupName(layerIds: number[]): Promise<string> {
    try {
      const analyses = await layerInspector.analyzeLayers(layerIds);
      
      if (analyses.length === 0) {
        return this.getTimestampedName('Group');
      }

      // Analyze content types
      const contentTypes = this.analyzeContentTypes(analyses);
      const layerTypes = this.analyzeLayerTypes(analyses);
      const commonTokens = this.findCommonNameTokens(analyses);

      // Generate name based on analysis
      if (commonTokens.length > 0) {
        return this.capitalizeWords(commonTokens.join(' ')) + ' Group';
      }

      if (contentTypes.dominant) {
        return this.getContentTypeName(contentTypes.dominant) + ' Group';
      }

      if (layerTypes.dominant) {
        return this.getLayerTypeName(layerTypes.dominant) + ' Group';
      }

      return this.getTimestampedName('Group');
    } catch (error) {
      console.error('Failed to generate group name:', error);
      return this.getTimestampedName('Group');
    }
  }

  /**
   * Learn from user grouping patterns
   */
  async learnFromGrouping(groupId: number, layerIds: number[]): Promise<void> {
    try {
      // Analyze the grouped layers
      const analyses = await layerInspector.analyzeLayers(layerIds);
      
      // Extract patterns
      const patterns = this.extractGroupingPatterns(analyses);
      
      // Store patterns for future suggestions
      // In a full implementation, this would update ML models or pattern databases
      console.log('Learned grouping patterns:', patterns);
    } catch (error) {
      console.error('Failed to learn from grouping:', error);
    }
  }

  // Private methods - Grouping strategies

  private async suggestByContentSimilarity(analyses: LayerAnalysis[]): Promise<GroupingSuggestion[]> {
    const suggestions: GroupingSuggestion[] = [];
    const grouped = new Set<number>();

    for (let i = 0; i < analyses.length; i++) {
      if (grouped.has(analyses[i].id)) continue;

      const similar: LayerAnalysis[] = [analyses[i]];
      grouped.add(analyses[i].id);

      for (let j = i + 1; j < analyses.length; j++) {
        if (grouped.has(analyses[j].id)) continue;

        const similarity = this.calculateContentSimilarity(analyses[i], analyses[j]);
        if (similarity > 0.7) {
          similar.push(analyses[j]);
          grouped.add(analyses[j].id);
        }
      }

      if (similar.length >= 2) {
        suggestions.push({
          layers: similar.map(l => l.id),
          confidence: this.calculateGroupConfidence(similar, 'content'),
          reasoning: 'similar content type and properties',
          suggestedName: this.generateNameFromAnalyses(similar),
          strategy: GroupingStrategy.CONTENT_SIMILARITY,
        });
      }
    }

    return suggestions;
  }

  private async suggestBySpatialProximity(analyses: LayerAnalysis[]): Promise<GroupingSuggestion[]> {
    const suggestions: GroupingSuggestion[] = [];
    const grouped = new Set<number>();

    for (let i = 0; i < analyses.length; i++) {
      if (grouped.has(analyses[i].id)) continue;

      const nearby: LayerAnalysis[] = [analyses[i]];
      grouped.add(analyses[i].id);

      for (let j = i + 1; j < analyses.length; j++) {
        if (grouped.has(analyses[j].id)) continue;

        const distance = this.calculateDistance(
          analyses[i].spatialInfo.center,
          analyses[j].spatialInfo.center
        );

        if (distance <= this.PROXIMITY_THRESHOLD) {
          nearby.push(analyses[j]);
          grouped.add(analyses[j].id);
        }
      }

      if (nearby.length >= 2) {
        suggestions.push({
          layers: nearby.map(l => l.id),
          confidence: this.calculateGroupConfidence(nearby, 'spatial'),
          reasoning: 'spatially close to each other',
          suggestedName: this.generateNameFromAnalyses(nearby),
          strategy: GroupingStrategy.SPATIAL_PROXIMITY,
        });
      }
    }

    return suggestions;
  }

  private async suggestByNamePattern(analyses: LayerAnalysis[]): Promise<GroupingSuggestion[]> {
    const suggestions: GroupingSuggestion[] = [];
    const grouped = new Set<number>();

    for (let i = 0; i < analyses.length; i++) {
      if (grouped.has(analyses[i].id)) continue;

      const similar: LayerAnalysis[] = [analyses[i]];
      grouped.add(analyses[i].id);

      for (let j = i + 1; j < analyses.length; j++) {
        if (grouped.has(analyses[j].id)) continue;

        const nameSimilarity = this.calculateNameSimilarity(
          analyses[i].semanticInfo.nameTokens,
          analyses[j].semanticInfo.nameTokens
        );

        if (nameSimilarity > 0.6) {
          similar.push(analyses[j]);
          grouped.add(analyses[j].id);
        }
      }

      if (similar.length >= 2) {
        suggestions.push({
          layers: similar.map(l => l.id),
          confidence: this.calculateGroupConfidence(similar, 'name'),
          reasoning: 'similar naming patterns',
          suggestedName: this.generateNameFromAnalyses(similar),
          strategy: GroupingStrategy.NAME_PATTERN,
        });
      }
    }

    return suggestions;
  }

  private async suggestByType(analyses: LayerAnalysis[]): Promise<GroupingSuggestion[]> {
    const suggestions: GroupingSuggestion[] = [];
    const typeGroups = new Map<LayerType, LayerAnalysis[]>();

    // Group by type
    for (const analysis of analyses) {
      if (!typeGroups.has(analysis.type)) {
        typeGroups.set(analysis.type, []);
      }
      typeGroups.get(analysis.type)!.push(analysis);
    }

    // Create suggestions for each type with multiple layers
    for (const [type, layers] of typeGroups) {
      if (layers.length >= 2) {
        suggestions.push({
          layers: layers.map(l => l.id),
          confidence: this.calculateGroupConfidence(layers, 'type'),
          reasoning: `all ${type} layers`,
          suggestedName: `${this.getLayerTypeName(type)} Group`,
          strategy: GroupingStrategy.TYPE_BASED,
        });
      }
    }

    return suggestions;
  }

  // Private helper methods

  private calculateContentSimilarity(a: LayerAnalysis, b: LayerAnalysis): number {
    let similarity = 0;
    let factors = 0;

    // Content type similarity
    if (a.contentType === b.contentType) {
      similarity += 0.4;
    }
    factors++;

    // Layer type similarity
    if (a.type === b.type) {
      similarity += 0.3;
    }
    factors++;

    // Semantic similarity
    const semanticSim = this.calculateNameSimilarity(
      a.semanticInfo.nameTokens,
      b.semanticInfo.nameTokens
    );
    similarity += semanticSim * 0.3;
    factors++;

    return similarity / factors;
  }

  private calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): number {
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

  private calculateGroupConfidence(layers: LayerAnalysis[], strategy: string): number {
    let confidence = 0.5; // Base confidence

    // More layers = higher confidence
    if (layers.length >= 3) {
      confidence += 0.1;
    }
    if (layers.length >= 5) {
      confidence += 0.1;
    }

    // Strategy-specific adjustments
    if (strategy === 'content') {
      const avgSemanticConfidence = layers.reduce((sum, l) => sum + l.semanticInfo.confidence, 0) / layers.length;
      confidence += avgSemanticConfidence * 0.2;
    }

    if (strategy === 'spatial') {
      // Tighter clustering = higher confidence
      const avgDistance = this.calculateAverageDistance(layers);
      if (avgDistance < 100) {
        confidence += 0.2;
      }
    }

    return Math.min(confidence, 1.0);
  }

  private calculateAverageDistance(layers: LayerAnalysis[]): number {
    if (layers.length < 2) return 0;

    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        totalDistance += this.calculateDistance(
          layers[i].spatialInfo.center,
          layers[j].spatialInfo.center
        );
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  private analyzeContentTypes(analyses: LayerAnalysis[]): {
    dominant: ContentType | null;
    distribution: Map<ContentType, number>;
  } {
    const distribution = new Map<ContentType, number>();
    
    for (const analysis of analyses) {
      distribution.set(analysis.contentType, (distribution.get(analysis.contentType) || 0) + 1);
    }

    let dominant: ContentType | null = null;
    let maxCount = 0;

    for (const [type, count] of distribution) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type;
      }
    }

    return { dominant, distribution };
  }

  private analyzeLayerTypes(analyses: LayerAnalysis[]): {
    dominant: LayerType | null;
    distribution: Map<LayerType, number>;
  } {
    const distribution = new Map<LayerType, number>();
    
    for (const analysis of analyses) {
      distribution.set(analysis.type, (distribution.get(analysis.type) || 0) + 1);
    }

    let dominant: LayerType | null = null;
    let maxCount = 0;

    for (const [type, count] of distribution) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type;
      }
    }

    return { dominant, distribution };
  }

  private findCommonNameTokens(analyses: LayerAnalysis[]): string[] {
    if (analyses.length === 0) return [];

    const tokenSets = analyses.map(a => new Set(a.semanticInfo.nameTokens));
    const commonTokens = new Set(tokenSets[0]);

    for (let i = 1; i < tokenSets.length; i++) {
      for (const token of commonTokens) {
        if (!tokenSets[i].has(token)) {
          commonTokens.delete(token);
        }
      }
    }

    return Array.from(commonTokens);
  }

  private generateNameFromAnalyses(analyses: LayerAnalysis[]): string {
    const commonTokens = this.findCommonNameTokens(analyses);
    
    if (commonTokens.length > 0) {
      return this.capitalizeWords(commonTokens.join(' ')) + ' Group';
    }

    const contentTypes = this.analyzeContentTypes(analyses);
    if (contentTypes.dominant) {
      return this.getContentTypeName(contentTypes.dominant) + ' Group';
    }

    const layerTypes = this.analyzeLayerTypes(analyses);
    if (layerTypes.dominant) {
      return this.getLayerTypeName(layerTypes.dominant) + ' Group';
    }

    return this.getTimestampedName('Group');
  }

  private extractGroupingPatterns(analyses: LayerAnalysis[]): any {
    return {
      contentTypes: this.analyzeContentTypes(analyses),
      layerTypes: this.analyzeLayerTypes(analyses),
      spatialClustering: this.calculateAverageDistance(analyses),
      commonTokens: this.findCommonNameTokens(analyses),
    };
  }

  private getContentTypeName(type: ContentType): string {
    const names: Record<ContentType, string> = {
      [ContentType.UI_ELEMENT]: 'UI Elements',
      [ContentType.ICON]: 'Icons',
      [ContentType.BUTTON]: 'Buttons',
      [ContentType.TEXT_BLOCK]: 'Text',
      [ContentType.IMAGE_CONTENT]: 'Images',
      [ContentType.BACKGROUND]: 'Background',
      [ContentType.DECORATION]: 'Decorations',
      [ContentType.UNKNOWN]: 'Mixed',
    };
    return names[type] || 'Mixed';
  }

  private getLayerTypeName(type: LayerType): string {
    const names: Record<LayerType, string> = {
      [LayerType.TEXT]: 'Text',
      [LayerType.SHAPE]: 'Shapes',
      [LayerType.IMAGE]: 'Images',
      [LayerType.GROUP]: 'Groups',
      [LayerType.ADJUSTMENT]: 'Adjustments',
      [LayerType.SMART_OBJECT]: 'Smart Objects',
      [LayerType.UNKNOWN]: 'Layers',
    };
    return names[type] || 'Layers';
  }

  private getTimestampedName(prefix: string): string {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${prefix} ${time}`;
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// Export singleton instance
export const autoGrouper = new AutoGrouper();

// Export types
export type { GroupingSuggestion, GroupingOptions };
export { GroupingStrategy };