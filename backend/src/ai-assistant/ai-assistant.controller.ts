import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AiAssistantService } from './ai-assistant.service';
import {
  AiChatDto,
  ConfirmAiActionDto,
  GenerateDescriptionDto,
} from './dto/chat.dto';

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/ai-assistant')
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Get('insights')
  insights(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assistant.insights(orgId, user.id);
  }

  @Post('chat')
  chat(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AiChatDto,
  ) {
    return this.assistant.chat(orgId, user.id, dto.message);
  }

  @Post('descriptions')
  description(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateDescriptionDto,
  ) {
    return this.assistant.generateDescription(
      orgId,
      user.id,
      dto.title,
      dto.bullets,
    );
  }

  @Post('actions/confirm')
  confirm(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmAiActionDto,
  ) {
    return this.assistant.confirmAction(
      orgId,
      user.id,
      dto.confirmationToken,
    );
  }
}
