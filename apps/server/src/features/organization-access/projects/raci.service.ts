import { Inject, Injectable } from '@nestjs/common';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import {
  planAccountableTransfer,
  replaceRaciRoles,
} from '@planix/core/features/organization-access/raci-invariants.ts';
import type { RaciRole } from '@planix/core/features/organization-access/roles.ts';
import type {
  AccountableChange,
  ProjectMemberView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import type { Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { AccountableLocks, PROJECTS_REPOSITORY, type ProjectsRepository } from './projects.repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RACI roles and the one-step Accountable change (FR-020); the project was authorized by AuthorizationGuard. */
@Injectable()
export class RaciService {
  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(PROJECTS_REPOSITORY) private readonly projects: ProjectsRepository,
  ) {}

  async replaceRaciRoles(
    tx: Tx,
    principal: Principal,
    projectId: string,
    projectMemberId: string,
    requested: readonly RaciRole[],
  ): Promise<ProjectMemberView> {
    if (!UUID.test(projectMemberId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const member = await this.projects.lockActiveMember(tx, projectId, projectMemberId);
    if (member === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    const plan = replaceRaciRoles(new Set(member.raciRoles), requested);
    if (!plan.ok) throw new DomainError(plan.code);
    const unchanged =
      plan.raciRoles.length === member.raciRoles.length &&
      plan.raciRoles.every((role, i) => role === member.raciRoles[i]);
    if (unchanged) {
      return (await this.projects.members(tx, projectId)).find((m) => m.projectMemberId === projectMemberId)!;
    }

    await this.projects.replaceAssignableRaciRoles(tx, {
      organizationId: principal.organizationId,
      projectId,
      projectMemberId,
      raciRoles: plan.raciRoles,
      now: this.clock.now(),
    });
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'project.raci.update',
      targetType: 'projectMember',
      targetId: projectMemberId,
      outcome: 'succeeded',
      before: { raciRoles: member.raciRoles },
      after: { raciRoles: plan.raciRoles },
    });
    return (await this.projects.members(tx, projectId)).find((m) => m.projectMemberId === projectMemberId)!;
  }

  /** Replaces the Accountable in one transaction; locks follow AccountableLocks' fixed order. */
  async changeAccountable(
    tx: Tx,
    principal: Principal,
    projectId: string,
    projectMemberId: string,
  ): Promise<AccountableChange> {
    await AccountableLocks.lockProject(tx, projectId);
    const previous = await this.projects.accountable(tx, projectId);
    if (previous === undefined) throw new Error(`Project ${projectId} has no Accountable`);
    const active = await AccountableLocks.lockActiveCandidate(tx, projectId, projectMemberId);
    const plan = planAccountableTransfer(
      { accountableProjectMemberId: previous.projectMemberId },
      { projectMemberId, status: active ? 'active' : 'none' },
    );
    if (!plan.ok) throw new DomainError(plan.code);
    if (!plan.changed) return { previous, current: previous };

    await this.projects.moveAccountable(tx, {
      organizationId: principal.organizationId,
      projectId,
      fromProjectMemberId: plan.previousProjectMemberId,
      toProjectMemberId: plan.currentProjectMemberId,
      now: this.clock.now(),
    });
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'project.accountable.change',
      targetType: 'project',
      targetId: projectId,
      outcome: 'succeeded',
      before: { projectMemberId: plan.previousProjectMemberId },
      after: { projectMemberId: plan.currentProjectMemberId },
    });
    const current = await this.projects.accountable(tx, projectId);
    return { previous, current: current! };
  }
}
