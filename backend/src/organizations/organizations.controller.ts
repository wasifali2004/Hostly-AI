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
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.organizations.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(user.id, dto);
  }

  @Get('by-slug/:slug')
  findOneBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.findOneBySlug(slug, user.id);
  }

  @Get(':orgId')
  findOne(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.findOne(orgId, user.id);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Patch(':orgId')
  update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(orgId, user.id, dto);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Get(':orgId/members')
  members(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.members(orgId, user.id);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Post(':orgId/members')
  addMember(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.organizations.addMember(orgId, user.id, dto);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Patch(':orgId/members/:memberId')
  updateMember(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.organizations.updateMember(orgId, memberId, user.id, dto);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Delete(':orgId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.removeMember(orgId, memberId, user.id);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Post(':orgId/invitations')
  invite(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.organizations.invite(orgId, user.id, dto);
  }

  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.organizations.acceptInvitation(token, user.id);
  }
}

@Public()
@Controller('public/organizations')
export class PublicOrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get(':orgSlug')
  findOne(@Param('orgSlug') orgSlug: string) {
    return this.organizations.findPublicBySlug(orgSlug);
  }
}
