import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  CheckInController,
  EventRegistrationsController,
  RegistrationsController,
} from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [AuditModule, AuthModule, NotificationsModule],
  controllers: [
    RegistrationsController,
    CheckInController,
    EventRegistrationsController,
  ],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
