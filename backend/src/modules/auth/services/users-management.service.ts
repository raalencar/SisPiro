import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { rethrowKnownPrismaError } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
  UsersQueryDto,
} from '../auth.dto.js';
import { AuthenticatedUser } from '../auth.constants.js';
import { PasswordHasher } from '../password-hasher.js';
import { ADMIN_CHANGE_LOCK_ID } from '../auth.common.js';

@Injectable()
export class UsersManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "usuarios" WHERE "id" = ${user.id}::uuid FOR UPDATE
      `;
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, passwordHash: true },
      });
      if (
        !current ||
        !(await this.passwordHasher.verify(
          dto.currentPassword,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Senha atual inválida.');
      }
      if (
        await this.passwordHasher.verify(dto.newPassword, current.passwordHash)
      ) {
        throw new BadRequestException(
          'A nova senha deve ser diferente da senha atual.',
        );
      }
      const passwordHash = await this.passwordHasher.hash(dto.newPassword);
      await tx.user.update({
        where: { id: current.id },
        data: { passwordHash },
      });
      await tx.authSession.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await createAuditLog(tx, {
        data: {
          actorId: current.id,
          action: 'auth.password.changed',
          aggregateType: 'User',
          aggregateId: current.id,
        },
      });
    });
    return { message: 'Senha alterada. Entre novamente para continuar.' };
  }

  async listUsers(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          active: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async createUser(actor: AuthenticatedUser, dto: CreateUserDto) {
    try {
      const passwordHash = await this.passwordHasher.hash(dto.password);
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            roles: dto.roles,
          },
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
            active: true,
            createdAt: true,
          },
        });
        await createAuditLog(tx, {
          data: {
            actorId: actor.id,
            action: 'auth.user.created',
            aggregateType: 'User',
            aggregateId: user.id,
            after: { email: user.email, roles: user.roles },
          },
        });
        return user;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async updateUser(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(${ADMIN_CHANGE_LOCK_ID})::text AS "lock"
      `;
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Usuário não encontrado.');
      }
      if (
        dto.name === undefined &&
        dto.roles === undefined &&
        dto.active === undefined
      ) {
        throw new BadRequestException(
          'Informe ao menos um campo para atualizar.',
        );
      }
      const roles = dto.roles ?? current.roles;
      const active = dto.active ?? current.active;
      if (
        current.active &&
        current.roles.includes(UserRole.ADMIN) &&
        (!active || !roles.includes(UserRole.ADMIN))
      ) {
        const activeAdmins = await tx.user.count({
          where: { active: true, roles: { has: UserRole.ADMIN } },
        });
        if (activeAdmins <= 1) {
          throw new ConflictException(
            'Não é possível desativar ou rebaixar o último administrador ativo.',
          );
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.roles === undefined ? {} : { roles: dto.roles }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          active: true,
          createdAt: true,
        },
      });
      if (!updated.active) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await createAuditLog(tx, {
        data: {
          actorId: actor.id,
          action: 'auth.user.updated',
          aggregateType: 'User',
          aggregateId: id,
          before: {
            name: current.name,
            roles: current.roles,
            active: current.active,
          },
          after: {
            name: updated.name,
            roles: updated.roles,
            active: updated.active,
          },
        },
      });
      return updated;
    });
  }
}
