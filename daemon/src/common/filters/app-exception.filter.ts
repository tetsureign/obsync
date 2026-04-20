import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { ZodSerializationException } from 'nestjs-zod';
import { ZodError } from 'zod';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    if (exception instanceof HttpException) {
      if (exception instanceof ZodSerializationException) {
        const zodError = exception.getZodError();

        if (zodError instanceof ZodError) {
          this.logger.error(`ZodSerializationException: ${zodError.message}`);
        }
      }

      const status = exception.getStatus();
      return response.status(status).json(exception.getResponse());
    }

    this.logger.error('Unhandled exception', {
      exception,
      method: request.method,
      path: request.url,
    });

    return response.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
