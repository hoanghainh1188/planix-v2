import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import {
  AssignRolesRequest,
  MembershipStatusFilter,
  type MemberView,
} from '@planix/core/features/organization-access/schemas/members.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { RequireAction } from '../../../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../../../shared/db/request-transaction.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { MembersService } from './members.service.ts';

/** contracts/api.md §Thành viên tổ chức và vai trò (active organization from the session only). */
@Controller('org/members')
export class MembersController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Get()
  @RequireAction('org.member.read')
  async list(@Req() req: AuthenticatedRequest, @Query('status') status: unknown): Promise<{ items: MemberView[] }> {
    const filter = parseBody(MembershipStatusFilter, status);
    return { items: await this.members.list(requireRequestTransaction(req), req.principal!, filter) };
  }

  @Put(':membershipId/roles')
  @RequireAction('org.member.role.assign')
  assignRoles(
    @Req() req: AuthenticatedRequest,
    @Param('membershipId') membershipId: string,
    @Body() body: unknown,
  ): Promise<MemberView> {
    const { roles } = parseBody(AssignRolesRequest, body);
    return this.members.assignRoles(requireRequestTransaction(req), req.principal!, membershipId, roles);
  }

  @Post(':membershipId/deactivate')
  @HttpCode(200)
  @RequireAction('org.member.deactivate')
  deactivate(@Req() req: AuthenticatedRequest, @Param('membershipId') membershipId: string): Promise<MemberView> {
    return this.members.deactivate(requireRequestTransaction(req), req.principal!, membershipId);
  }

  @Post(':membershipId/reactivate')
  @HttpCode(200)
  @RequireAction('org.member.reactivate')
  reactivate(@Req() req: AuthenticatedRequest, @Param('membershipId') membershipId: string): Promise<MemberView> {
    return this.members.reactivate(requireRequestTransaction(req), req.principal!, membershipId);
  }
}
