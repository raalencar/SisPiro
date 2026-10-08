import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../modules/auth/auth.constants.js';
import { auditContext } from './audit-context.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actorId = request.user?.id;

    return new Observable((subscriber) =>
      auditContext.run(actorId ? { actorId } : {}, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
