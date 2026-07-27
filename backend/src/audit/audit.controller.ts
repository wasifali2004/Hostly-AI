import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AuditService } from './audit.service';
import { ActivityQueryDto } from './dto/activity-query.dto';

@OrgRoles(OrgRole.ORG_ADMIN)
@Controller('organizations/:orgId/activity')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  findAll(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ActivityQueryDto,
  ) {
    return this.audit.findAll(orgId, user.id, query);
  }
}
