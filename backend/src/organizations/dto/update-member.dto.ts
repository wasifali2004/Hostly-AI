import { IsEnum } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsEnum(OrgRole)
  role: OrgRole;
}
