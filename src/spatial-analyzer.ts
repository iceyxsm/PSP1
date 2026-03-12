/**
 * Spatial Analyzer
 * Analyzes spatial relationships between layers for intelligent grouping
 */

import { LayerAnalysis, SpatialInfo } from './layer-inspector';

interface SpatialCluster {
  layers: number[];
  centroid: { x: number; y: number };
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  density: number;
  cohesion: number;
}

interface AlignmentInfo {
  horizontal: AlignmentGroup[];
  vertical: AlignmentGroup[];
  grid: GridInfo | null;
}

interface AlignmentGroup {
  layers: number[];
  position: number;
  tolerance: number;
  type: 'left' | 'right' | 'top' | 'bottom' | 'center';
}

interface GridInfo {
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  layers: number[][];
}

class SpatialAnalyzer {
  private readonly PROXIMITY_THRESHOLD = 150;
  private readonly ALIGNMENT_TOLERANCE = 5;
  private readonly GRID_TOLERANCE = 10;

  /**
   * Cluster layers based on spatial proximity
   */
  clusterByProximity(
    analyses: LayerAnalysis[],
    threshold: number = this.PROXIMITY_THRESHOLD
  ): SpatialCluster[] {
    if (analyses.length === 0) return [];

    const clusters: SpatialCluster[] = [];
    const assigned = new Set<number>();

    for (const analysis of analyses) {
      if (assigned.has(analysis.id)) continue;

      const cluster = this.buildCluster(analysis, analyses, assigned, threshold);
      if (cluster.layers.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Detect alignment patterns between layers
   */
  detectAlignment(analyses: LayerAnalysis[]): AlignmentInfo {
    const horizontal = this.detectHorizontalAlignment(analyses);
    const vertical = this.detectVerticalAlignment(analyses);
    const grid = this.detectGridPattern(analyses);

    return {
      horizontal,
      vertical,
      grid,
    };
  }

  /**
   * Calculate spatial relationships between two layers
   */
  calculateRelationship(
    layer1: LayerAnalysis,
    layer2: LayerAnalysis
  ): {
    distance: number;
    direction: string;
    aligned: boolean;
    overlapping: boolean;
  } {
    const distance = this.calculateDistance(
      layer1.spatialInfo.center,
      layer2.spatialInfo.center
    );

    const direction = this.calculateDirection(
      layer1.spatialInfo.center,
      layer2.spatialInfo.center
    );

    const aligned = this.checkAlignment(layer1.spatialInfo, layer2.spatialInfo);
    const overlapping = this.checkOverlap(layer1.spatialInfo.bounds, layer2.spatialInfo.bounds);

    return {
      distance,
      direction,
      aligned,
      overlapping,
    };
  }

  /**
   * Find layers within a specific region
   */
  findLayersInRegion(
    analyses: LayerAnalysis[],
    region: { left: number; top: number; right: number; bottom: number }
  ): LayerAnalysis[] {
    return analyses.filter(analysis => {
      const center = analysis.spatialInfo.center;
      return (
        center.x >= region.left &&
        center.x <= region.right &&
        center.y >= region.top &&
        center.y <= region.bottom
      );
    });
  }

  /**
   * Calculate optimal bounding box for a group of layers
   */
  calculateGroupBounds(analyses: LayerAnalysis[]): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } {
    if (analyses.length === 0) {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const analysis of analyses) {
      const bounds = analysis.spatialInfo.bounds;
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.right);
      bottom = Math.max(bottom, bounds.bottom);
    }

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  // Private methods

  private buildCluster(
    seed: LayerAnalysis,
    allLayers: LayerAnalysis[],
    assigned: Set<number>,
    threshold: number
  ): SpatialCluster {
    const clusterLayers: LayerAnalysis[] = [seed];
    assigned.add(seed.id);

    // Iteratively add nearby layers
    let changed = true;
    while (changed) {
      changed = false;

      for (const layer of allLayers) {
        if (assigned.has(layer.id)) continue;

        // Check if layer is close to any layer in the cluster
        for (const clusterLayer of clusterLayers) {
          const distance = this.calculateDistance(
            layer.spatialInfo.center,
            clusterLayer.spatialInfo.center
          );

          if (distance <= threshold) {
            clusterLayers.push(layer);
            assigned.add(layer.id);
            changed = true;
            break;
          }
        }
      }
    }

    const centroid = this.calculateCentroid(clusterLayers);
    const bounds = this.calculateGroupBounds(clusterLayers);
    const density = this.calculateDensity(clusterLayers, bounds);
    const cohesion = this.calculateCohesion(clusterLayers);

    return {
      layers: clusterLayers.map(l => l.id),
      centroid,
      bounds,
      density,
      cohesion,
    };
  }

  private detectHorizontalAlignment(analyses: LayerAnalysis[]): AlignmentGroup[] {
    const groups: AlignmentGroup[] = [];

    // Check top alignment
    groups.push(...this.findAlignedLayers(analyses, 'top'));
    
    // Check bottom alignment
    groups.push(...this.findAlignedLayers(analyses, 'bottom'));
    
    // Check vertical center alignment
    groups.push(...this.findAlignedLayers(analyses, 'center'));

    return groups.filter(g => g.layers.length >= 2);
  }

  private detectVerticalAlignment(analyses: LayerAnalysis[]): AlignmentGroup[] {
    const groups: AlignmentGroup[] = [];

    // Check left alignment
    groups.push(...this.findAlignedLayers(analyses, 'left'));
    
    // Check right alignment
    groups.push(...this.findAlignedLayers(analyses, 'right'));
    
    // Check horizontal center alignment
    groups.push(...this.findAlignedLayers(analyses, 'center'));

    return groups.filter(g => g.layers.length >= 2);
  }

  private findAlignedLayers(
    analyses: LayerAnalysis[],
    type: 'left' | 'right' | 'top' | 'bottom' | 'center'
  ): AlignmentGroup[] {
    const positions = new Map<number, number[]>();

    for (const analysis of analyses) {
      const position = this.getAlignmentPosition(analysis.spatialInfo, type);
      const roundedPos = Math.round(position / this.ALIGNMENT_TOLERANCE) * this.ALIGNMENT_TOLERANCE;

      if (!positions.has(roundedPos)) {
        positions.set(roundedPos, []);
      }
      positions.get(roundedPos)!.push(analysis.id);
    }

    const groups: AlignmentGroup[] = [];
    for (const [position, layers] of positions) {
      if (layers.length >= 2) {
        groups.push({
          layers,
          position,
          tolerance: this.ALIGNMENT_TOLERANCE,
          type,
        });
      }
    }

    return groups;
  }

  private detectGridPattern(analyses: LayerAnalysis[]): GridInfo | null {
    if (analyses.length < 4) return null;

    // Sort by position
    const sorted = [...analyses].sort((a, b) => {
      const dy = a.spatialInfo.center.y - b.spatialInfo.center.y;
      if (Math.abs(dy) > this.GRID_TOLERANCE) return dy;
      return a.spatialInfo.center.x - b.spatialInfo.center.x;
    });

    // Try to detect rows
    const rows: LayerAnalysis[][] = [];
    let currentRow: LayerAnalysis[] = [sorted[0]];
    let currentY = sorted[0].spatialInfo.center.y;

    for (let i = 1; i < sorted.length; i++) {
      const layer = sorted[i];
      const dy = Math.abs(layer.spatialInfo.center.y - currentY);

      if (dy <= this.GRID_TOLERANCE) {
        currentRow.push(layer);
      } else {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [layer];
        currentY = layer.spatialInfo.center.y;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Check if it's a valid grid
    if (rows.length < 2) return null;

    const columnsPerRow = rows.map(r => r.length);
    const minColumns = Math.min(...columnsPerRow);
    const maxColumns = Math.max(...columnsPerRow);

    if (maxColumns - minColumns > 1) return null; // Not a regular grid

    // Calculate cell dimensions
    const cellWidth = this.calculateAverageCellWidth(rows);
    const cellHeight = this.calculateAverageCellHeight(rows);

    return {
      rows: rows.length,
      columns: minColumns,
      cellWidth,
      cellHeight,
      layers: rows.map(row => row.map(l => l.id)),
    };
  }

  private getAlignmentPosition(spatial: SpatialInfo, type: string): number {
    switch (type) {
      case 'left':
        return spatial.bounds.left;
      case 'right':
        return spatial.bounds.right;
      case 'top':
        return spatial.bounds.top;
      case 'bottom':
        return spatial.bounds.bottom;
      case 'center':
        return spatial.center.x;
      default:
        return 0;
    }
  }

  private calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateDirection(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (angle >= -45 && angle < 45) return 'right';
    if (angle >= 45 && angle < 135) return 'down';
    if (angle >= 135 || angle < -135) return 'left';
    return 'up';
  }

  private checkAlignment(spatial1: SpatialInfo, spatial2: SpatialInfo): boolean {
    const tolerance = this.ALIGNMENT_TOLERANCE;

    // Check horizontal alignment
    if (
      Math.abs(spatial1.bounds.left - spatial2.bounds.left) <= tolerance ||
      Math.abs(spatial1.bounds.right - spatial2.bounds.right) <= tolerance ||
      Math.abs(spatial1.center.x - spatial2.center.x) <= tolerance
    ) {
      return true;
    }

    // Check vertical alignment
    if (
      Math.abs(spatial1.bounds.top - spatial2.bounds.top) <= tolerance ||
      Math.abs(spatial1.bounds.bottom - spatial2.bounds.bottom) <= tolerance ||
      Math.abs(spatial1.center.y - spatial2.center.y) <= tolerance
    ) {
      return true;
    }

    return false;
  }

  private checkOverlap(
    bounds1: { left: number; top: number; right: number; bottom: number },
    bounds2: { left: number; top: number; right: number; bottom: number }
  ): boolean {
    return !(
      bounds1.right < bounds2.left ||
      bounds1.left > bounds2.right ||
      bounds1.bottom < bounds2.top ||
      bounds1.top > bounds2.bottom
    );
  }

  private calculateCentroid(layers: LayerAnalysis[]): { x: number; y: number } {
    if (layers.length === 0) return { x: 0, y: 0 };

    const sum = layers.reduce(
      (acc, layer) => ({
        x: acc.x + layer.spatialInfo.center.x,
        y: acc.y + layer.spatialInfo.center.y,
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / layers.length,
      y: sum.y / layers.length,
    };
  }

  private calculateDensity(
    layers: LayerAnalysis[],
    bounds: { width: number; height: number }
  ): number {
    if (bounds.width === 0 || bounds.height === 0) return 0;

    const totalArea = layers.reduce((sum, layer) => sum + layer.spatialInfo.area, 0);
    const boundsArea = bounds.width * bounds.height;

    return boundsArea > 0 ? totalArea / boundsArea : 0;
  }

  private calculateCohesion(layers: LayerAnalysis[]): number {
    if (layers.length < 2) return 1.0;

    const centroid = this.calculateCentroid(layers);
    const avgDistance = layers.reduce((sum, layer) => {
      return sum + this.calculateDistance(layer.spatialInfo.center, centroid);
    }, 0) / layers.length;

    // Normalize cohesion (lower distance = higher cohesion)
    return 1.0 / (1.0 + avgDistance / 100);
  }

  private calculateAverageCellWidth(rows: LayerAnalysis[][]): number {
    let totalWidth = 0;
    let count = 0;

    for (const row of rows) {
      for (let i = 1; i < row.length; i++) {
        const width = row[i].spatialInfo.center.x - row[i - 1].spatialInfo.center.x;
        totalWidth += width;
        count++;
      }
    }

    return count > 0 ? totalWidth / count : 0;
  }

  private calculateAverageCellHeight(rows: LayerAnalysis[][]): number {
    if (rows.length < 2) return 0;

    let totalHeight = 0;
    for (let i = 1; i < rows.length; i++) {
      const height = rows[i][0].spatialInfo.center.y - rows[i - 1][0].spatialInfo.center.y;
      totalHeight += height;
    }

    return totalHeight / (rows.length - 1);
  }
}

// Export singleton instance
export const spatialAnalyzer = new SpatialAnalyzer();

// Export types
export type { SpatialCluster, AlignmentInfo, AlignmentGroup, GridInfo };