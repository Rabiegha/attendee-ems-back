import * as Sentry from '@sentry/node';

/**
 * Backend Logger wrapper that sends logs to Sentry in production
 */
export class SentryLogger {
  /**
   * Log info message
   */
  static info(message: string, context?: string, data?: Record<string, any>) {
    console.log(`[${context || 'App'}] ${message}`, data || '');
    
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      Sentry.captureMessage(message, {
        level: 'info',
        ...(data && { extra: data }),
        ...(context && { tags: { context } }),
      });
    }
  }

  /**
   * Log warning message
   */
  static warn(message: string, context?: string, data?: Record<string, any>) {
    console.warn(`[${context || 'App'}] ${message}`, data || '');
    
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(message, {
        level: 'warning',
        ...(data && { extra: data }),
        ...(context && { tags: { context } }),
      });
    }
  }

  /**
   * Log error message
   */
  static error(
    message: string,
    error?: Error | any,
    context?: string,
    data?: Record<string, any>,
  ) {
    console.error(`[${context || 'App'}] ${message}`, error, data || '');
    
    if (error instanceof Error) {
      Sentry.captureException(error, {
        ...(data && { extra: { message, ...data } }),
        ...(context && { tags: { context } }),
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: { error, ...data },
        ...(context && { tags: { context } }),
      });
    }
  }

  /**
   * Debug log (console only, never sent to Sentry)
   */
  static debug(message: string, context?: string, data?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${context || 'App'}] ${message}`, data || '');
    }
  }
}
