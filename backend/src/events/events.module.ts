import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PublicCacheService } from '../common/cache/public-cache.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VenuesModule } from '../venues/venues.module';
import { EventsController, PublicEventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuditModule, NotificationsModule, VenuesModule],
  controllers: [EventsController, PublicEventsController],
  providers: [EventsService, PublicCacheService],
  exports: [EventsService],
})
export class EventsModule {}
