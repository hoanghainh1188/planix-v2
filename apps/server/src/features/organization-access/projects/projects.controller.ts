import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import {
  CreateProjectRequest,
  type ProjectDetail,
  type ProjectView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { RequireAction } from '../../../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../../../shared/db/request-transaction.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { ProjectsService } from './projects.service.ts';

/** contracts/api.md §Dự án (active organization from the session only). */
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  @RequireAction('project.create')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown): Promise<ProjectDetail> {
    return this.projects.create(requireRequestTransaction(req), req.principal!, parseBody(CreateProjectRequest, body));
  }

  @Get()
  @RequireAction('project.list')
  async list(@Req() req: AuthenticatedRequest): Promise<{ items: ProjectView[] }> {
    return { items: await this.projects.list(requireRequestTransaction(req), req.principal!) };
  }

  @Get(':projectId')
  @RequireAction('project.read')
  get(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string): Promise<ProjectDetail> {
    return this.projects.get(requireRequestTransaction(req), req.principal!, projectId);
  }
}
