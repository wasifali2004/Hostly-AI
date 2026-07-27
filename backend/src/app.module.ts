import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'node:path';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ComplianceModule } from './compliance/compliance.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrgRolesGuard } from './common/guards/org-roles.guard';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { UploadsModule } from './uploads/uploads.module';
import { VenuesModule } from './venues/venues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), 'backend', '.env'),
        resolve(process.cwd(), '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    EventsModule,
    RegistrationsModule,
    AnalyticsModule,
    AiAssistantModule,
    AuditModule,
    ComplianceModule,
    NotificationsModule,
    UploadsModule,
    VenuesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OrgRolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
  ],
})
export class AppModule {}
