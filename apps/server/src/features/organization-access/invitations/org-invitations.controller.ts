import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import {
  CreateInvitationRequest,
  InvitationStatusFilter,
  type InvitationView,
} from '@planix/core/features/organization-access/schemas/members.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { RequireAction } from '../../../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../../../shared/db/request-transaction.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { InvitationService } from './invitation.service.ts';

/** contracts/api.md §Lời mời — organization side (active organization from the session only). */
@Controller('org/invitations')
export class OrganizationInvitationsController {
  constructor(@Inject(InvitationService) private readonly invitations: InvitationService) {}

  @Post()
  @RequireAction('org.member.invite')
  async invite(@Req() req: AuthenticatedRequest, @Body() body: unknown): Promise<{ invitation: InvitationView }> {
    const { email, roles } = parseBody(CreateInvitationRequest, body);
    const invitation = await this.invitations.invite(requireRequestTransaction(req), req.principal!, email, roles);
    return { invitation };
  }

  @Get()
  @RequireAction('org.member.invite')
  async list(@Req() req: AuthenticatedRequest, @Query('status') status: unknown): Promise<{ items: InvitationView[] }> {
    const filter = parseBody(InvitationStatusFilter, status);
    return {
      items: await this.invitations.listForOrganization(requireRequestTransaction(req), req.principal!, filter),
    };
  }

  @Delete(':invitationId')
  @HttpCode(204)
  @RequireAction('org.member.invite')
  async revoke(@Req() req: AuthenticatedRequest, @Param('invitationId') invitationId: string): Promise<void> {
    await this.invitations.revoke(requireRequestTransaction(req), req.principal!, invitationId);
  }
}
