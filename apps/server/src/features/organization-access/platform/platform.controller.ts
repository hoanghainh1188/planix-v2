import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import {
  AdminInvitationRequest,
  CreateOrganizationRequest,
} from '@planix/core/features/organization-access/schemas/auth.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { PlatformAction } from '../../../shared/authorization/platform-action.decorator.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { PlatformService } from './platform.service.ts';

/** contracts/api.md §Platform Operator. Operator identity is enforced by AuthorizationGuard (@PlatformAction). */
@Controller('platform/organizations')
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post()
  @PlatformAction('platform.organization.create')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const { name, firstAdminEmail } = parseBody(CreateOrganizationRequest, body);
    return this.platform.createOrganization(req.auth!.userId, name, firstAdminEmail);
  }

  @Get()
  @PlatformAction('platform.organization.list')
  list() {
    return this.platform.listOrganizations();
  }

  @Post(':organizationId/admin-invitations')
  @PlatformAction('platform.invitation.admin.resend')
  resend(@Req() req: AuthenticatedRequest, @Param('organizationId') organizationId: string, @Body() body: unknown) {
    const { email } = parseBody(AdminInvitationRequest, body);
    return this.platform.resendAdminInvitation(req.auth!.userId, organizationId, email);
  }
}
