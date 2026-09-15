import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import {
  AddProjectMemberRequest,
  type ProjectMemberView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { RequireAction } from '../../../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../../../shared/db/request-transaction.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { ProjectMembersService } from './project-members.service.ts';

/** contracts/api.md §Thành viên dự án. `projectId` is resolved and authorized by AuthorizationGuard first. */
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(@Inject(ProjectMembersService) private readonly members: ProjectMembersService) {}

  @Get()
  @RequireAction('project.read')
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ): Promise<{ items: ProjectMemberView[] }> {
    return { items: await this.members.list(requireRequestTransaction(req), projectId) };
  }

  @Post()
  @RequireAction('project.member.manage')
  add(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ): Promise<ProjectMemberView> {
    const { membershipId } = parseBody(AddProjectMemberRequest, body);
    return this.members.add(requireRequestTransaction(req), req.principal!, projectId, membershipId);
  }

  @Delete(':projectMemberId')
  @HttpCode(204)
  @RequireAction('project.member.manage')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('projectMemberId') projectMemberId: string,
  ): Promise<void> {
    await this.members.remove(requireRequestTransaction(req), req.principal!, projectId, projectMemberId);
  }
}
