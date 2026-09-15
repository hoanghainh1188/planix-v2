import { Body, Controller, Inject, Param, Put, Req } from '@nestjs/common';
import {
  ChangeAccountableRequest,
  ReplaceRaciRolesRequest,
  type AccountableChange,
  type ProjectMemberView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { RequireAction } from '../../../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../../../shared/db/request-transaction.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { RaciService } from './raci.service.ts';

/** contracts/api.md §RACI — `projectId` is resolved and authorized by AuthorizationGuard first. */
@Controller('projects/:projectId')
export class RaciController {
  constructor(@Inject(RaciService) private readonly raci: RaciService) {}

  @Put('members/:projectMemberId/raci')
  @RequireAction('project.raci.manage')
  replaceRaciRoles(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('projectMemberId') projectMemberId: string,
    @Body() body: unknown,
  ): Promise<ProjectMemberView> {
    const { raciRoles } = parseBody(ReplaceRaciRolesRequest, body);
    return this.raci.replaceRaciRoles(
      requireRequestTransaction(req),
      req.principal!,
      projectId,
      projectMemberId,
      raciRoles,
    );
  }

  @Put('accountable')
  @RequireAction('project.raci.manage')
  changeAccountable(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ): Promise<AccountableChange> {
    const { projectMemberId } = parseBody(ChangeAccountableRequest, body);
    return this.raci.changeAccountable(requireRequestTransaction(req), req.principal!, projectId, projectMemberId);
  }
}
