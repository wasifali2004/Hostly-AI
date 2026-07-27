import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const ORG_ROLES_KEY = 'organizationRoles';
export const OrgRoles = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);
