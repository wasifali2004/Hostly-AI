import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user';
import { CheckInDto } from './dto/check-in.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';
import { RegistrationsService } from './registrations.service';

@Controller()
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('public/events/:eventId/registrations')
  register(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: CreateRegistrationDto,
    @Req() request: Request & { user?: AuthUser },
  ) {
    return this.registrations.register(eventId, dto, request.user);
  }

  @Get('registrations/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.registrations.mine(user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('registrations/:id/calendar.ics')
  async calendar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('code') code: string | undefined,
    @Req() request: Request & { user?: AuthUser },
    @Res() response: Response,
  ) {
    const calendar = await this.registrations.calendar(
      id,
      code,
      request.user,
    );
    response
      .type('text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${calendar.filename}"`)
      .send(calendar.content);
  }

  @Get('registrations/:id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrations.findOne(id, user);
  }
}

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/events/:eventId/check-in')
export class CheckInController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post()
  checkIn(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckInDto,
  ) {
    return this.registrations.checkIn(orgId, eventId, user.id, dto);
  }

  @Get('stats')
  stats(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrations.checkInStats(orgId, eventId, user.id);
  }
}

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/events/:eventId/registrations')
export class EventRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  findAll(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: RegistrationsQueryDto,
  ) {
    return this.registrations.findForEvent(orgId, eventId, user.id, query);
  }
}
