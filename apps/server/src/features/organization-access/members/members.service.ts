import { Inject, Injectable } from '@nestjs/common';
import {
  checkDeactivation,
  checkRoleChange,
  planReactivation,
  type InvariantViolation,
} from '@planix/core/features/organization-access/membership-invariants.ts';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { MembershipStatus, MemberView } from '@planix/core/features/organization-access/schemas/members.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import type { Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { MEMBERS_REPOSITORY, type MembersRepository } from './members.repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDomainError(violation: InvariantViolation): DomainError {
  return violation.code === 'ACCOUNTABLE_REQUIRED'
    ? new DomainError(violation.code, { projectIds: violation.projectIds })
    : new DomainError(violation.code);
}

/** Organization members: system roles, deactivation, reactivation (FR-012, FR-014, FR-015). */
@Injectable()
export class MembersService {
  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(MEMBERS_REPOSITORY) private readonly members: MembersRepository,
  ) {}

  list(tx: Tx, principal: Principal, status?: MembershipStatus): Promise<MemberView[]> {
    return this.members.list(tx, principal.organizationId, status);
  }

  async assignRoles(tx: Tx, principal: Principal, membershipId: string, roles: readonly SystemRole[]) {
    const { member: before, admins } = await this.#lockedMember(tx, principal, membershipId);
    const check = checkRoleChange({ activeAdminMembershipIds: admins }, before, roles);
    if (!check.ok) throw toDomainError(check);

    await this.members.replaceRoles(tx, principal.organizationId, membershipId, check.roles, this.clock.now());
    await this.#audit(
      tx,
      principal,
      'org.member.role.assign',
      membershipId,
      { roles: before.roles },
      {
        roles: check.roles,
      },
    );
    return this.#reload(tx, principal, membershipId);
  }

  async deactivate(tx: Tx, principal: Principal, membershipId: string) {
    const { member: before, admins } = await this.#lockedMember(tx, principal, membershipId);
    if (before.status === 'deactivated') return before;
    const check = checkDeactivation(
      { activeAdminMembershipIds: admins },
      before,
      await this.members.accountableProjectIds(tx, membershipId),
    );
    if (!check.ok) throw toDomainError(check);

    await this.members.deactivate(tx, membershipId, this.clock.now());
    await this.#audit(
      tx,
      principal,
      'org.member.deactivate',
      membershipId,
      { status: before.status, roles: before.roles },
      { status: 'deactivated', roles: [] },
    );
    return this.#reload(tx, principal, membershipId);
  }

  async reactivate(tx: Tx, principal: Principal, membershipId: string) {
    const { member: before } = await this.#lockedMember(tx, principal, membershipId);
    const plan = planReactivation(before);
    if (!plan.ok) throw toDomainError(plan);

    await this.members.reactivate(tx, principal.organizationId, membershipId, plan.roles, this.clock.now());
    await this.#audit(
      tx,
      principal,
      'org.member.reactivate',
      membershipId,
      { status: before.status },
      { status: 'active', roles: plan.roles },
    );
    return this.#reload(tx, principal, membershipId);
  }

  /** Locks the target and the active admins first, then reads the target's current state. */
  async #lockedMember(
    tx: Tx,
    principal: Principal,
    membershipId: string,
  ): Promise<{ member: MemberView; admins: ReadonlySet<string> }> {
    if (!UUID.test(membershipId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const admins = await this.members.lockAdmins(tx, principal.organizationId, membershipId);
    const member = await this.members.find(tx, principal.organizationId, membershipId);
    if (member === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    return { member, admins };
  }

  async #reload(tx: Tx, principal: Principal, membershipId: string): Promise<MemberView> {
    return (await this.members.find(tx, principal.organizationId, membershipId))!;
  }

  #audit(tx: Tx, principal: Principal, action: string, targetId: string, before: unknown, after: unknown) {
    return this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action,
      targetType: 'organizationMembership',
      targetId,
      outcome: 'succeeded',
      before,
      after,
    });
  }
}
