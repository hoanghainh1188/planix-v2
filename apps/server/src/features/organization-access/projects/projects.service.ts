import { Inject, Injectable } from '@nestjs/common';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type {
  CreateProjectRequest,
  ProjectDetail,
  ProjectView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import type { Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { PROJECTS_REPOSITORY, type ProjectsRepository } from './projects.repository.ts';

/** Projects (FR-016, FR-018). Access to a single project is already decided by AuthorizationGuard. */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(PROJECTS_REPOSITORY) private readonly projects: ProjectsRepository,
  ) {}

  /** The creator becomes a project member and the Accountable, all in the request's transaction. */
  async create(tx: Tx, principal: Principal, input: CreateProjectRequest): Promise<ProjectDetail> {
    const membershipId = await this.projects.activeMembershipId(tx, principal.organizationId, principal.userId);
    if (membershipId === undefined) throw new DomainError('MEMBERSHIP_INACTIVE');
    const description = input.description ?? null;
    const { project } = await this.projects.create(tx, {
      organizationId: principal.organizationId,
      name: input.name,
      description,
      membershipId,
      now: this.clock.now(),
    });
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'project.create',
      targetType: 'project',
      targetId: project.id,
      outcome: 'succeeded',
      after: { name: project.name, description, accountableMembershipId: membershipId },
    });
    return this.#detail(tx, principal, project);
  }

  list(tx: Tx, principal: Principal): Promise<ProjectView[]> {
    return this.projects.listForUser(tx, principal.organizationId, principal.userId);
  }

  async get(tx: Tx, principal: Principal, projectId: string): Promise<ProjectDetail> {
    const project = await this.projects.find(tx, principal.organizationId, projectId);
    if (project === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    return this.#detail(tx, principal, project);
  }

  async #detail(tx: Tx, _principal: Principal, project: ProjectView): Promise<ProjectDetail> {
    const accountable = await this.projects.accountable(tx, project.id);
    // Decision single-accountable-per-project: a project without Accountable is a broken invariant, not a state.
    if (accountable === undefined) throw new Error(`Project ${project.id} has no Accountable`);
    return { project, accountable };
  }
}
