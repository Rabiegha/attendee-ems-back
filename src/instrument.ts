// Sentry initialization for NestJS
// Must be imported before any other code
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Only initialize if DSN is configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of requests
    
    // Profiling
    profilesSampleRate: 0.1, // 10% of transactions
    
    // Disable default integrations that interfere with body parsing
    skipOpenTelemetrySetup: true,
  });

  console.log('✅ Sentry initialized for backend');
} else {
  console.log('ℹ️ Sentry disabled (no DSN configured)');
}
