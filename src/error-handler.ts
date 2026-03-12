/**
 * Error Handler
 * Comprehensive error handling and recovery system
 */

enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

enum ErrorCategory {
  USER_ERROR = 'user_error',
  SYSTEM_ERROR = 'system_error',
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_ERROR = 'permission_error',
}

interface PluginError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: Date;
  context?: any;
  stack?: string;
  recoverable: boolean;
  userMessage: string;
}

interface ErrorRecoveryStrategy {
  canRecover: (error: PluginError) => boolean;
  recover: (error: PluginError) => Promise<boolean>;
  description: string;
}

interface ErrorLog {
  errors: PluginError[];
  maxSize: number;
}

class ErrorHandler {
  private errorLog: ErrorLog = {
    errors: [],
    maxSize: 100,
  };
  
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private errorListeners: Array<(error: PluginError) => void> = [];

  constructor() {
    this.registerDefaultRecoveryStrategies();
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(
    error: Error | string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    category: ErrorCategory = ErrorCategory.SYSTEM_ERROR,
    context?: any
  ): Promise<PluginError> {
    const pluginError = this.createPluginError(error, severity, category, context);
    
    // Log the error
    this.logError(pluginError);
    
    // Notify listeners
    this.notifyListeners(pluginError);
    
    // Attempt recovery if error is recoverable
    if (pluginError.recoverable) {
      const recovered = await this.attemptRecovery(pluginError);
      if (recovered) {
        console.log(`Successfully recovered from error: ${pluginError.id}`);
      }
    }
    
    // Show user notification based on severity
    this.notifyUser(pluginError);
    
    return pluginError;
  }

  /**
   * Register an error listener
   */
  addErrorListener(listener: (error: PluginError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove an error listener
   */
  removeErrorListener(listener: (error: PluginError) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  /**
   * Register a recovery strategy
   */
  registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    console.log(`Registered recovery strategy: ${strategy.description}`);
  }

  /**
   * Get error log
   */
  getErrorLog(filter?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    limit?: number;
  }): PluginError[] {
    let errors = [...this.errorLog.errors];
    
    if (filter) {
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity);
      }
      if (filter.category) {
        errors = errors.filter(e => e.category === filter.category);
      }
      if (filter.limit) {
        errors = errors.slice(-filter.limit);
      }
    }
    
    return errors.reverse();
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog.errors = [];
    console.log('Error log cleared');
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    recoveryRate: number;
  } {
    const total = this.errorLog.errors.length;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    const byCategory = {} as Record<ErrorCategory, number>;
    let recoveredCount = 0;

    for (const error of this.errorLog.errors) {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      
      if (error.recoverable) {
        recoveredCount++;
      }
    }

    return {
      total,
      bySeverity,
      byCategory,
      recoveryRate: total > 0 ? recoveredCount / total : 0,
    };
  }

  // Private methods

  private createPluginError(
    error: Error | string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: any
  ): PluginError {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    
    return {
      id: this.generateErrorId(),
      message,
      severity,
      category,
      timestamp: new Date(),
      context,
      stack,
      recoverable: this.isRecoverable(category, severity),
      userMessage: this.generateUserMessage(message, category),
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRecoverable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    // Critical errors are generally not recoverable
    if (severity === ErrorSeverity.CRITICAL) {
      return false;
    }
    
    // Some categories are more recoverable than others
    const recoverableCategories = [
      ErrorCategory.NETWORK_ERROR,
      ErrorCategory.API_ERROR,
      ErrorCategory.USER_ERROR,
    ];
    
    return recoverableCategories.includes(category);
  }

  private generateUserMessage(message: string, category: ErrorCategory): string {
    const categoryMessages: Record<ErrorCategory, string> = {
      [ErrorCategory.USER_ERROR]: 'Please check your input and try again.',
      [ErrorCategory.SYSTEM_ERROR]: 'An unexpected error occurred. Please try again.',
      [ErrorCategory.API_ERROR]: 'Failed to communicate with Photoshop. Please try again.',
      [ErrorCategory.NETWORK_ERROR]: 'Network connection failed. Please check your connection.',
      [ErrorCategory.VALIDATION_ERROR]: 'Invalid input. Please correct and try again.',
      [ErrorCategory.PERMISSION_ERROR]: 'Permission denied. Please check your access rights.',
    };
    
    return `${message} ${categoryMessages[category] || ''}`;
  }

  private logError(error: PluginError): void {
    this.errorLog.errors.push(error);
    
    // Trim log if it exceeds max size
    if (this.errorLog.errors.length > this.errorLog.maxSize) {
      this.errorLog.errors.shift();
    }
    
    // Console logging based on severity
    const logMethod = {
      [ErrorSeverity.INFO]: console.info,
      [ErrorSeverity.WARNING]: console.warn,
      [ErrorSeverity.ERROR]: console.error,
      [ErrorSeverity.CRITICAL]: console.error,
    }[error.severity];
    
    logMethod(`[${error.severity.toUpperCase()}] ${error.message}`, error);
  }

  private notifyListeners(error: PluginError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    }
  }

  private async attemptRecovery(error: PluginError): Promise<boolean> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        try {
          console.log(`Attempting recovery with strategy: ${strategy.description}`);
          const recovered = await strategy.recover(error);
          
          if (recovered) {
            console.log(`Recovery successful with strategy: ${strategy.description}`);
            return true;
          }
        } catch (recoveryError) {
          console.error(`Recovery strategy failed: ${strategy.description}`, recoveryError);
        }
      }
    }
    
    return false;
  }

  private notifyUser(error: PluginError): void {
    // In a real implementation, this would show UI notifications
    // For now, we'll just log to console
    
    const notificationLevel = {
      [ErrorSeverity.INFO]: 'info',
      [ErrorSeverity.WARNING]: 'warning',
      [ErrorSeverity.ERROR]: 'error',
      [ErrorSeverity.CRITICAL]: 'critical',
    }[error.severity];
    
    console.log(`User notification [${notificationLevel}]: ${error.userMessage}`);
  }

  private registerDefaultRecoveryStrategies(): void {
    // Strategy 1: Retry for network errors
    this.registerRecoveryStrategy({
      description: 'Retry network operations',
      canRecover: (error) => error.category === ErrorCategory.NETWORK_ERROR,
      recover: async (error) => {
        // Implement retry logic
        console.log('Retrying network operation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false; // Would return true if retry succeeded
      },
    });

    // Strategy 2: Clear cache for API errors
    this.registerRecoveryStrategy({
      description: 'Clear cache and retry',
      canRecover: (error) => error.category === ErrorCategory.API_ERROR,
      recover: async (error) => {
        console.log('Clearing cache and retrying...');
        // Would clear relevant caches here
        return false;
      },
    });

    // Strategy 3: Provide user guidance for validation errors
    this.registerRecoveryStrategy({
      description: 'Provide user guidance',
      canRecover: (error) => error.category === ErrorCategory.VALIDATION_ERROR,
      recover: async (error) => {
        console.log('Providing user guidance for validation error');
        // Would show detailed validation feedback
        return true; // User can fix the issue
      },
    });
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export types and enums
export { ErrorSeverity, ErrorCategory };
export type { PluginError, ErrorRecoveryStrategy, ErrorLog };