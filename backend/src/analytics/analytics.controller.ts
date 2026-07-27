import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AnalyticsService } from './analytics.service';

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.analytics.overview(orgId, user.id);
  }
}
