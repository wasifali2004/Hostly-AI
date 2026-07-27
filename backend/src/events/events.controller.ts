import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateEventDto } from './dto/create-event.dto';
import {
  ManagementEventsQueryDto,
  PublicEventsQueryDto,
} from './dto/events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  findAll(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ManagementEventsQueryDto,
  ) {
    return this.events.findManagement(orgId, user.id, query);
  }

  @Post()
  create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.events.create(orgId, user.id, dto);
  }

  @Get(':eventId')
  findOne(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.findManagementOne(orgId, eventId, user.id);
  }

  @Patch(':eventId')
  update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(orgId, eventId, user.id, dto);
  }

  @Post(':eventId/publish')
  publish(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.publish(orgId, eventId, user.id);
  }

  @Post(':eventId/unpublish')
  unpublish(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.unpublish(orgId, eventId, user.id);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.remove(orgId, eventId, user.id);
  }
}

@Public()
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  findAll(@Query() query: PublicEventsQueryDto) {
    return this.events.findPublic(query);
  }

  @Get(':slug/calendar.ics')
  async calendar(@Param('slug') slug: string, @Res() response: Response) {
    const calendar = await this.events.calendar(slug);
    response
      .type('text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${calendar.filename}"`)
      .setHeader('Cache-Control', 'public, max-age=300')
      .send(calendar.content);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.events.findPublicOne(slug);
  }
}
