import { Controller, Get, Post } from '@nestjs/common';
import { SentryLogger } from '../common/logger/sentry-logger';
import * as Sentry from '@sentry/node';

@Controller('sentry-test')
export class SentryTestController {
  @Get('info')
  testInfo() {
    SentryLogger.info('Test info log from backend', 'SentryTest', {
      timestamp: new Date().toISOString(),
      action: 'test_info',
    });
    return { message: 'Info log sent to Sentry', level: 'info' };
  }

  @Get('warn')
  testWarn() {
    SentryLogger.warn('Test warning log from backend', 'SentryTest', {
      timestamp: new Date().toISOString(),
      action: 'test_warning',
    });
    return { message: 'Warning log sent to Sentry', level: 'warning' };
  }

  @Get('error')
  testError() {
    SentryLogger.error(
      'Test error log from backend',
      new Error('This is a test error!'),
      'SentryTest',
      { action: 'test_error' },
    );
    return { message: 'Error log sent to Sentry', level: 'error' };
  }

  @Get('exception')
  testException() {
    throw new Error('💥 This is a test backend exception!');
  }

  @Get('status')
  getStatus() {
    return {
      sentry_enabled: !!process.env.SENTRY_DSN,
      sentry_dsn_configured: !!process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      node_env: process.env.NODE_ENV,
    };
  }
}
