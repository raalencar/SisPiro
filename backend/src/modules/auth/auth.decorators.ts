import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from './auth.constants.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
