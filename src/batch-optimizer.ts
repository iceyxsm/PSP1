/**
 * Batch Optimizer Component
 * Optimizes batch operations for large layer selections
 */

import { performanceMonitor } from './performance-monitor';

interface BatchOperation<T, R> {
  items: T[];
  operation: (item: T) => Promise<R>;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
  onBatchComplete?: (results: R[]) => void;
  cancellable?: boolean;
}

interface BatchResult<R> {
  success: boolean;
  results: R[];
  errors: Array<{ index: number; error: Error }>;
  cancelled: boolean;
  duration: number;
}

class BatchOptimizer {
  private defaultBatchSize: number = 10;
  private cancelledOperations: Set<string> = new Set();

  /**
   * Execute batch operation with optimization
   */
  async executeBatch<T, R>(
    operation: BatchOperation<T, R>
  ): Promise<BatchResult<R>> {
    const operationId = performanceMonitor.startOperation(
      'batch_operation',
      operation.items.length
    );

    const startTime = performance.now();
    const batchSize = operation.batchSize || this.defaultBatchSize;
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];
    let cancelled = false;

    try {
      // Process items in batches
      for (let i = 0; i < operation.items.length; i += batchSize) {
        // Check if operation was cancelled
        if (operation.cancellable && this.cancelledOperations.has(operationId)) {
          cancelled = true;
          break;
        }

        const batch = operation.items.slice(i, i + batchSize);
        const batchResults = await this.processBatch(
          batch,
          operation.operation,
          i,
          errors
        );

        results.push(...batchResults);

        // Report progress
        if (operation.onProgress) {
          operation.onProgress(
            Math.min(i + batchSize, operation.items.length),
            operation.items.length
          );
        }

        // Callback for batch completion
        if (operation.onBatchComplete) {
          operation.onBatchComplete(batchResults);
        }

        // Small delay between batches to prevent UI blocking
        await this.delay(10);
      }

      const duration = performance.now() - startTime;

      performanceMonitor.endOperation(
        operationId,
        !cancelled && errors.length === 0
      );

      return {
        success: !cancelled && errors.length === 0,
        results,
        errors,
        cancelled,
        duration,
      };
    } catch (error) {
      performanceMonitor.endOperation(
        operationId,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    } finally {
      this.cancelledOperations.delete(operationId);
    }
  }

  /**
   * Process a single batch
   */
  private async processBatch<T, R>(
    batch: T[],
    operation: (item: T) => Promise<R>,
    startIndex: number,
    errors: Array<{ index: number; error: Error }>
  ): Promise<R[]> {
    const results: R[] = [];

    // Process batch items in parallel
    const promises = batch.map(async (item, batchIndex) => {
      try {
        const result = await operation(item);
        return { success: true, result, index: startIndex + batchIndex };
      } catch (error) {
        errors.push({
          index: startIndex + batchIndex,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
        return { success: false, result: null as any, index: startIndex + batchIndex };
      }
    });

    const batchResults = await Promise.all(promises);

    // Collect successful results
    for (const result of batchResults) {
      if (result.success) {
        results.push(result.result);
      }
    }

    return results;
  }

  /**
   * Cancel a batch operation
   */
  cancelOperation(operationId: string): void {
    this.cancelledOperations.add(operationId);
  }

  /**
   * Optimize batch size based on item count
   */
  getOptimalBatchSize(itemCount: number): number {
    if (itemCount <= 10) return itemCount;
    if (itemCount <= 50) return 10;
    if (itemCount <= 100) return 20;
    if (itemCount <= 500) return 50;
    return 100;
  }

  /**
   * Execute operation with automatic batching
   */
  async executeWithAutoBatching<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    const batchSize = this.getOptimalBatchSize(items.length);

    return this.executeBatch({
      items,
      operation,
      batchSize,
      onProgress,
      cancellable: true,
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await this.delay(delayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Execute operations in sequence
   */
  async executeSequential<T, R>(
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    const startTime = performance.now();
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await operation(items[i], i);
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      }

      if (onProgress) {
        onProgress(i + 1, items.length);
      }
    }

    const duration = performance.now() - startTime;

    return {
      success: errors.length === 0,
      results,
      errors,
      cancelled: false,
      duration,
    };
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Chunk array into smaller arrays
   */
  chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const batchOptimizer = new BatchOptimizer();

// Export types
export type { BatchOperation, BatchResult };
