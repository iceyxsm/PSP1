/**
 * Performance Monitor Component
 * Tracks operation timing, memory usage, and performance metrics
 */

interface PerformanceMetric {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  layerCount?: number;
  success: boolean;
  error?: string;
}

interface PerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  totalMemoryUsed: number;
  operationBreakdown: Map<string, OperationStats>;
}

interface OperationStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  successRate: number;
}

interface PerformanceThresholds {
  maxGroupingTime: number; // 500ms for up to 50 layers
  maxLongOperationTime: number; // 2000ms with progress indicator
  memoryWarningThreshold: number; // MB
  memoryCriticalThreshold: number; // MB
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeOperations: Map<string, PerformanceMetric> = new Map();
  private thresholds: PerformanceThresholds = {
    maxGroupingTime: 500,
    maxLongOperationTime: 2000,
    memoryWarningThreshold: 100,
    memoryCriticalThreshold: 200,
  };
  private cleanupInterval: number = 300000; // 5 minutes
  private maxMetricsHistory: number = 1000;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Start tracking an operation
   */
  startOperation(
    operationName: string,
    layerCount?: number
  ): string {
    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
    
    const metric: PerformanceMetric = {
      operationName,
      startTime: performance.now(),
      memoryBefore: this.getMemoryUsage(),
      layerCount,
      success: false,
    };

    this.activeOperations.set(operationId, metric);
    return operationId;
  }

  /**
   * End tracking an operation
   */
  endOperation(
    operationId: string,
    success: boolean = true,
    error?: string
  ): PerformanceMetric | null {
    const metric = this.activeOperations.get(operationId);
    
    if (!metric) {
      console.warn(`Operation ${operationId} not found`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.memoryAfter = this.getMemoryUsage();
    metric.memoryDelta = metric.memoryAfter - (metric.memoryBefore || 0);
    metric.success = success;
    metric.error = error;

    // Check performance thresholds
    this.checkThresholds(metric);

    // Store metric
    this.metrics.push(metric);
    this.activeOperations.delete(operationId);

    // Cleanup old metrics if needed
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    return metric;
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Check if operation exceeded thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    if (!metric.duration) return;

    // Check grouping operation threshold
    if (metric.operationName.includes('group') && metric.layerCount) {
      if (metric.layerCount <= 50 && metric.duration > this.thresholds.maxGroupingTime) {
        console.warn(
          `Grouping operation exceeded threshold: ${metric.duration}ms for ${metric.layerCount} layers`
        );
      }
    }

    // Check long operation threshold
    if (metric.duration > this.thresholds.maxLongOperationTime) {
      console.warn(
        `Operation ${metric.operationName} exceeded long operation threshold: ${metric.duration}ms`
      );
    }

    // Check memory thresholds
    const currentMemory = this.getMemoryUsage();
    if (currentMemory > this.thresholds.memoryCriticalThreshold) {
      console.error(`Critical memory usage: ${currentMemory.toFixed(2)}MB`);
      this.triggerMemoryCleanup();
    } else if (currentMemory > this.thresholds.memoryWarningThreshold) {
      console.warn(`High memory usage: ${currentMemory.toFixed(2)}MB`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const operationBreakdown = new Map<string, OperationStats>();

    // Calculate overall stats
    let totalDuration = 0;
    let maxDuration = 0;
    let minDuration = Infinity;
    let successfulOps = 0;
    let failedOps = 0;

    for (const metric of this.metrics) {
      if (!metric.duration) continue;

      totalDuration += metric.duration;
      maxDuration = Math.max(maxDuration, metric.duration);
      minDuration = Math.min(minDuration, metric.duration);

      if (metric.success) {
        successfulOps++;
      } else {
        failedOps++;
      }

      // Update operation breakdown
      const opName = metric.operationName;
      if (!operationBreakdown.has(opName)) {
        operationBreakdown.set(opName, {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          maxDuration: 0,
          minDuration: Infinity,
          successRate: 0,
        });
      }

      const opStats = operationBreakdown.get(opName)!;
      opStats.count++;
      opStats.totalDuration += metric.duration;
      opStats.maxDuration = Math.max(opStats.maxDuration, metric.duration);
      opStats.minDuration = Math.min(opStats.minDuration, metric.duration);
    }

    // Calculate averages and success rates
    for (const [opName, stats] of operationBreakdown) {
      stats.averageDuration = stats.totalDuration / stats.count;
      
      const opMetrics = this.metrics.filter(m => m.operationName === opName);
      const successCount = opMetrics.filter(m => m.success).length;
      stats.successRate = (successCount / opMetrics.length) * 100;
    }

    return {
      totalOperations: this.metrics.length,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      averageDuration: this.metrics.length > 0 ? totalDuration / this.metrics.length : 0,
      maxDuration,
      minDuration: minDuration === Infinity ? 0 : minDuration,
      totalMemoryUsed: this.getMemoryUsage(),
      operationBreakdown,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics for specific operation
   */
  getOperationMetrics(operationName: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.operationName === operationName);
  }

  /**
   * Check if operation is within performance requirements
   */
  isPerformant(operationName: string, layerCount?: number): boolean {
    const metrics = this.getOperationMetrics(operationName);
    
    if (metrics.length === 0) return true;

    const recentMetrics = metrics.slice(-10);
    const avgDuration = recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / recentMetrics.length;

    // Check grouping performance
    if (operationName.includes('group') && layerCount && layerCount <= 50) {
      return avgDuration <= this.thresholds.maxGroupingTime;
    }

    // Check general performance
    return avgDuration <= this.thresholds.maxLongOperationTime;
  }

  /**
   * Trigger memory cleanup
   */
  private triggerMemoryCleanup(): void {
    console.log('Triggering memory cleanup...');
    
    // Clear old metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Clear completed operations
    this.activeOperations.clear();

    // Suggest garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performScheduledCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Perform scheduled cleanup
   */
  private performScheduledCleanup(): void {
    const currentMemory = this.getMemoryUsage();
    
    // Only cleanup if memory is above warning threshold
    if (currentMemory > this.thresholds.memoryWarningThreshold) {
      this.triggerMemoryCleanup();
    }

    // Remove metrics older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.startTime > oneHourAgo);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      stats: this.getStats(),
      recentMetrics: this.getRecentMetrics(50),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    const stats = this.getStats();
    const memory = this.getMemoryUsage();

    let report = '=== Performance Report ===\n\n';
    report += `Total Operations: ${stats.totalOperations}\n`;
    report += `Successful: ${stats.successfulOperations}\n`;
    report += `Failed: ${stats.failedOperations}\n`;
    report += `Success Rate: ${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(2)}%\n\n`;
    
    report += `Average Duration: ${stats.averageDuration.toFixed(2)}ms\n`;
    report += `Max Duration: ${stats.maxDuration.toFixed(2)}ms\n`;
    report += `Min Duration: ${stats.minDuration.toFixed(2)}ms\n\n`;
    
    report += `Current Memory: ${memory.toFixed(2)}MB\n\n`;
    
    report += '=== Operation Breakdown ===\n';
    for (const [opName, opStats] of stats.operationBreakdown) {
      report += `\n${opName}:\n`;
      report += `  Count: ${opStats.count}\n`;
      report += `  Avg Duration: ${opStats.averageDuration.toFixed(2)}ms\n`;
      report += `  Max Duration: ${opStats.maxDuration.toFixed(2)}ms\n`;
      report += `  Success Rate: ${opStats.successRate.toFixed(2)}%\n`;
    }

    return report;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type {
  PerformanceMetric,
  PerformanceStats,
  OperationStats,
  PerformanceThresholds,
};
