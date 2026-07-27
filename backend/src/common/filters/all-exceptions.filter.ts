import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'Something went wrong';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as Record<string, unknown>;
        message = (payload.message as string | string[]) ?? exception.message;
        code = (payload.code as string) ?? this.codeForStatus(status);
        details = payload.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        message = 'A record with these details already exists';
        details = exception.meta?.target;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'The requested resource was not found';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_REFERENCE';
        message = 'A referenced resource is invalid';
      } else if (
        exception.code === 'P2004' &&
        JSON.stringify(exception.meta ?? {}).includes(
          'events_room_time_no_overlap',
        )
      ) {
        status = HttpStatus.CONFLICT;
        code = 'ROOM_BOOKING_CONFLICT';
        message = 'Room is already booked for an overlapping event';
      }
    }

    if (status >= 500 && process.env.NODE_ENV !== 'test') {
      console.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      error: code,
      code,
      message,
      ...(details ? { details } : {}),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private codeForStatus(status: number) {
    return (
      {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'UNPROCESSABLE_ENTITY',
      }[status] ?? 'REQUEST_FAILED'
    );
  }
}
