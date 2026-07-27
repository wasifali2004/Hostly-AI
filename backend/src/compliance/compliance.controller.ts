import {
  Body,
  Controller,
  Get,
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
import { AuthUser } from '../common/types/auth-user';
import { ComplianceService } from './compliance.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { DeletionRequestsQueryDto } from './dto/deletion-requests-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { ProcessDeletionRequestDto } from './dto/process-deletion-request.dto';

@Controller('organizations/:orgId/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Get('export')
  async export(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ExportQueryDto,
    @Res() response: Response,
  ) {
    const file = await this.compliance.export(orgId, user.id, query.format);
    response
      .type(file.contentType)
      .setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
      .setHeader('Cache-Control', 'no-store')
      .send(file.content);
  }

  @Post('deletion-requests')
  createDeletionRequest(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    return this.compliance.createDeletionRequest(orgId, user.id, dto);
  }

  @Get('deletion-requests/mine')
  mine(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.compliance.mine(orgId, user.id);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Get('deletion-requests')
  deletionRequests(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: DeletionRequestsQueryDto,
  ) {
    return this.compliance.deletionRequests(orgId, user.id, query);
  }

  @OrgRoles(OrgRole.ORG_ADMIN)
  @Patch('deletion-requests/:requestId')
  processDeletionRequest(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessDeletionRequestDto,
  ) {
    return this.compliance.processDeletionRequest(
      orgId,
      requestId,
      user.id,
      dto,
    );
  }
}
