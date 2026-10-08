import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import {
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from './auth.constants.js';

type AccessTokenPayload = { sub?: string; sid?: string };
type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso obrigatório.');
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Token de acesso obrigatório.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        throw new UnauthorizedException('Token inválido ou expirado.');
      }
      throw error;
    }
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
            active: true,
          },
        },
      },
    });
    if (
      !session ||
      session.user.id !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active
    ) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    request.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roles: session.user.roles,
    };

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      requiredRoles?.length &&
      !session.user.roles.includes(UserRole.ADMIN) &&
      !requiredRoles.some((role) => session.user.roles.includes(role))
    ) {
      throw new ForbiddenException('Perfil sem acesso a este módulo.');
    }
    return true;
  }
}
