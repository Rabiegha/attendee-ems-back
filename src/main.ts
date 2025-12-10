// Initialize Sentry before any other imports
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  // Disable NestJS default body parser to prevent Sentry double-parsing
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const configService = app.get(ConfigService);

  // Apply body parser AFTER app creation with custom limits
  // This prevents Sentry's OpenTelemetry instrumentation from consuming the stream first
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Cookie parser middleware
  app.use(cookieParser());

  // Enable CORS with credentials - handle multiple origins
  const allowedOrigins = configService.apiCorsOrigin.split(',').map(o => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      // Auto-accept Cloudflare Tunnel domains
      if (origin && origin.includes('.trycloudflare.com')) {
        console.log(`[CORS] ✅ Auto-accepting Cloudflare Tunnel: ${origin}`);
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'sentry-trace',
      'baggage',
    ],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('EMS API')
    .setDescription('Documentation de l\'Event Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.port;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
