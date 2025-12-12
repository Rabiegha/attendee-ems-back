import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let title: string;
    let extraData: Record<string, any> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const { message: msg, statusCode, ...rest } = exceptionResponse as any;
        message = msg || exception.message;
        extraData = rest;
      } else {
        message = exceptionResponse as string;
      }

      title = this.getHttpStatusText(status);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      title = 'Internal Server Error';
    }

    const errorResponse = {
      type: 'about:blank',
      title,
      status,
      detail: message,
      instance: request.url,
      ...extraData,
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }

  private getHttpStatusText(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 422: return 'Unprocessable Entity';
      case 500: return 'Internal Server Error';
      default: return 'Error';
    }
  }
}
