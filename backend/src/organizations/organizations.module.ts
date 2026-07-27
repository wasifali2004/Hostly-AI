import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  OrganizationsController,
  PublicOrganizationsController,
} from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [OrganizationsController, PublicOrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
