import { Inject, Injectable } from '@nestjs/common';
import { checkProjectMemberRemoval } from '@planix/core/features/organization-access/project-member-invariants.ts';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type { ProjectMemberView } from '@planix/core/features/organization-access/schemas/projects.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import type { Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { isUniqueViolation, PROJECTS_REPOSITORY, type ProjectsRepository } from './projects.repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Adding and removing project members (FR-019, FR-020); the project itself was resolved by AuthorizationGuard. */
@Injectable()
export class ProjectMembersService {
  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(PROJECTS_REPOSITORY) private readonly projects: ProjectsRepository,
  ) {}

  list(tx: Tx, projectId: string): Promise<ProjectMemberView[]> {
    return this.projects.members(tx, projectId);
  }

  async add(tx: Tx, principal: Principal, projectId: string, membershipId: string): Promise<ProjectMemberView> {
    if (!(await this.projects.isActiveMembership(tx, principal.organizationId, membershipId))) {
      throw new DomainError('RESOURCE_NOT_FOUND');
    }
    let projectMemberId: string;
    await tx.client.query('SAVEPOINT add_project_member');
    try {
      projectMemberId = await this.projects.addMember(
        tx,
        principal.organizationId,
        projectId,
        membershipId,
        this.clock.now(),
      );
      await tx.client.query('RELEASE SAVEPOINT add_project_member');
    } catch (error) {
      await tx.client.query('ROLLBACK TO SAVEPOINT add_project_member');
      if (isUniqueViolation(error)) throw new DomainError('ALREADY_PROJECT_MEMBER');
      throw error;
    }
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'project.member.add',
      targetType: 'projectMember',
      targetId: projectMemberId,
      outcome: 'succeeded',
      after: { projectId, membershipId },
    });
    const added = (await this.projects.members(tx, projectId)).find((m) => m.projectMemberId === projectMemberId);
    return added!;
  }

  async remove(tx: Tx, principal: Principal, projectId: string, projectMemberId: string): Promise<void> {
    if (!UUID.test(projectMemberId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const member = await this.projects.lockActiveMember(tx, projectId, projectMemberId);
    if (member === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    const check = checkProjectMemberRemoval({ projectId, raciRoles: new Set(member.raciRoles) });
    if (!check.ok) {
      throw check.code === 'ACCOUNTABLE_REQUIRED'
        ? new DomainError(check.code, { projectIds: check.projectIds })
        : new DomainError(check.code);
    }
    await this.projects.removeMember(tx, projectMemberId, this.clock.now());
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'project.member.remove',
      targetType: 'projectMember',
      targetId: projectMemberId,
      outcome: 'succeeded',
      before: { projectId, membershipId: member.membershipId, raciRoles: member.raciRoles },
    });
  }
}
