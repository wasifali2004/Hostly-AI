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
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesService } from './venues.service';

@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ORGANIZER)
@Controller('organizations/:orgId/venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get('availability')
  availability(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.venues.availability(orgId, user.id, query);
  }

  @Get()
  findAll(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venues.findAll(orgId, user.id);
  }

  @Post()
  create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVenueDto,
  ) {
    return this.venues.create(orgId, user.id, dto);
  }

  @Get(':venueId')
  findOne(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venues.findOne(orgId, venueId, user.id);
  }

  @Patch(':venueId')
  update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.update(orgId, venueId, user.id, dto);
  }

  @Delete(':venueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venues.remove(orgId, venueId, user.id);
  }

  @Post(':venueId/rooms')
  createRoom(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.venues.createRoom(orgId, venueId, user.id, dto);
  }

  @Patch(':venueId/rooms/:roomId')
  updateRoom(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.venues.updateRoom(orgId, venueId, roomId, user.id, dto);
  }

  @Delete(':venueId/rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRoom(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.venues.removeRoom(orgId, venueId, roomId, user.id);
  }
}
