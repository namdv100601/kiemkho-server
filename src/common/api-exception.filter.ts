import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi máy chủ';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as { message?: string | string[]; error?: string };
        if (Array.isArray(obj.message)) message = obj.message.join(', ');
        else if (typeof obj.message === 'string') message = obj.message;
        else if (obj.error) message = obj.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      console.error(exception);
    }

    res.status(status).json({ error: message });
  }
}
