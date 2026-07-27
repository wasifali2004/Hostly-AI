import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();
    const supplied = request.header('x-request-id')?.trim();
    const requestId =
      supplied && supplied.length <= 128 ? supplied : randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    return next.handle();
  }
}
