import { OrgRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  memberships?: Array<{
    organizationId: string;
    role: OrgRole;
  }>;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  jti?: string;
}
