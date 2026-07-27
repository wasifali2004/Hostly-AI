import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const rawOrganizationId = request.params.orgId;
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;
    if (!organizationId || !request.user) {
      throw new ForbiddenException('An organization membership is required');
    }
    if (!isUUID(organizationId)) {
      throw new BadRequestException('orgId must be a UUID');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: request.user.id,
        },
      },
      select: { role: true },
    });
    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission in this organization');
    }
    return true;
  }
}
