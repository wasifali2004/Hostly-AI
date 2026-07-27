import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [EventsModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
