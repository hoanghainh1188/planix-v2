import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, CSRF_COOKIE } from '../../shared/auth/session-cookie.ts';
import { SessionStore } from '../../shared/auth/session-store.ts';
import { hashToken } from '../../shared/auth/secure-token.ts';
import { systemClock } from '../../shared/clock/clock.ts';
import { Browser } from '../../test/browser.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { SampleFinancialModule } from '../../test/sample-financial.module.ts';
import { seedMembership, seedOperator, seedOrganization, seedProjectMember } from '../../test/seed.ts';
import { MEMBER_PASSWORD, signedInMember, type SignedInMember } from '../../test/signed-in-member.ts';
import { createTestApp } from '../../test/test-app.ts';

const db = useTestDatabase();
const mail = new RecordingMailSender();
const sessions = new SessionStore(db, systemClock);
let app: INestApplication;

/** Secrets seen while exercising the API; none may appear anywhere in audit_entry (FR-028). */
const secrets = new Set<string>([MEMBER_PASSWORD]);
const NEW_ACCOUNT_PASSWORD = 'harbor-quartz-77';
const RESET_PASSWORD = 'meadow-cobalt-93';
const SENSITIVE_BUDGET = '4321.1234';
secrets.add(NEW_ACCOUNT_PASSWORD).add(RESET_PASSWORD).add(SENSITIVE_BUDGET);

function rememberToken(token: string): string {
  const hash = hashToken(token);
  secrets.add(token).add(hash.toString('hex')).add(hash.toString('base64')).add(hash.toString('base64url'));
  return token;
}

async function tokenSentTo(email: string, kind: 'organizationInvitation' | 'passwordReset'): Promise<string> {
  return vi.waitFor(() => {
    const message = mail.lastTo(email);
    if (message?.kind === 'organizationInvitation' && kind === message.kind) {
      return rememberToken(message.acceptUrl.split('/invitations/')[1]!);
    }
    if (message?.kind === 'passwordReset' && kind === message.kind) {
      return rememberToken(message.resetUrl.split('token=')[1] ?? message.resetUrl.split('/').at(-1)!);
    }
    throw new Error(`no ${kind} mail to ${email} yet`);
  });
}

async function operatorBrowser(): Promise<Browser> {
  const browser = new Browser(app);
  const { sessionToken, csrfToken } = await sessions.create(await seedOperator(db), null);
  secrets.add(sessionToken).add(csrfToken);
  browser.cookies.set(SESSION_COOKIE, sessionToken);
  browser.cookies.set(CSRF_COOKIE, csrfToken);
  return browser;
}

/** Number of audit entries for an action, narrowed to one organization and/or target. */
async function auditCount(
  action: string,
  scope: { organizationId?: string; targetId?: string; outcome?: 'succeeded' | 'denied' },
): Promise<number> {
  const { rows } = await db.ownerPool.query<{ count: string }>(
    `SELECT count(*) FROM audit_entry
      WHERE action = $1
        AND ($2::uuid IS NULL OR organization_id = $2)
        AND ($3::uuid IS NULL OR target_id = $3)
        AND outcome = $4`,
    [action, scope.organizationId ?? null, scope.targetId ?? null, scope.outcome ?? 'succeeded'],
  );
  return Number(rows[0]!.count);
}

const email = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@acme.test`;

async function organizationWithAdmin(): Promise<{ organizationId: string; admin: SignedInMember }> {
  const organizationId = await seedOrganization(db, 'Acme');
  return { organizationId, admin: await signedInMember(app, db, organizationId, ['admin']) };
}

async function projectOf(organizationId: string): Promise<{ pm: SignedInMember; projectId: string }> {
  const pm = await signedInMember(app, db, organizationId, ['projectManager']);
  const created = await pm.browser.post('/projects', { name: `Project ${randomUUID().slice(0, 6)}` });
  expect(created.status).toBe(201);
  return { pm, projectId: created.body.project.id };
}

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: mail, extraModules: [SampleFinancialModule] });
});

afterAll(() => app.close());

describe('every FR-027 action writes exactly one audit entry (T121, SC-008, Q17)', () => {
  it('platform.organization.create — Platform Operator creates an organization', async () => {
    const operator = await operatorBrowser();
    const firstAdminEmail = email('first-admin');
    const created = await operator.post('/platform/organizations', { name: 'Audit Org', firstAdminEmail });
    expect(created.status).toBe(201);
    await tokenSentTo(firstAdminEmail, 'organizationInvitation');
    expect(await auditCount('platform.organization.create', { organizationId: created.body.organization.id })).toBe(1);
  });

  it('platform.invitation.admin.resend — Platform Operator resends the admin invitation', async () => {
    const operator = await operatorBrowser();
    const created = await operator.post('/platform/organizations', { name: 'Audit Org', firstAdminEmail: email('a') });
    const organizationId: string = created.body.organization.id;
    const resent = await operator.post(`/platform/organizations/${organizationId}/admin-invitations`, {
      email: email('second-admin'),
    });
    expect(resent.status).toBe(201);
    expect(await auditCount('platform.invitation.admin.resend', { organizationId })).toBe(1);
  });

  it('auth.session.switch-organization — switching the active organization', async () => {
    const { organizationId, admin } = await organizationWithAdmin();
    const other = await seedOrganization(db, 'Other');
    await seedMembership(db, other, admin.userId, ['member']);
    const switched = await admin.browser.put('/auth/session/active-organization', { organizationId: other });
    expect(switched.status).toBe(200);
    expect(await auditCount('auth.session.switch-organization', { targetId: other })).toBe(1);
    expect(await auditCount('auth.session.switch-organization', { targetId: organizationId })).toBe(0);
  });

  it('org.member.invite, org.invitation.revoke — inviting and revoking', async () => {
    const { organizationId, admin } = await organizationWithAdmin();
    const invited = await admin.browser.post('/org/invitations', { email: email('invitee') });
    expect(invited.status).toBe(201);
    const invitationId: string = invited.body.invitation.id;
    expect(await auditCount('org.member.invite', { organizationId, targetId: invitationId })).toBe(1);

    expect((await admin.browser.delete(`/org/invitations/${invitationId}`)).status).toBe(204);
    expect(await auditCount('org.invitation.revoke', { organizationId, targetId: invitationId })).toBe(1);
  });

  it('org.invitation.accept — accepting an invitation with a new account', async () => {
    const { organizationId, admin } = await organizationWithAdmin();
    const address = email('newcomer');
    const invited = await admin.browser.post('/org/invitations', { email: address });
    const token = await tokenSentTo(address, 'organizationInvitation');
    const browser = await new Browser(app).open();
    const accepted = await browser.post(`/invitations/${token}/accept`, { password: NEW_ACCOUNT_PASSWORD });
    expect(accepted.status).toBe(200);
    expect(await auditCount('org.invitation.accept', { organizationId, targetId: invited.body.invitation.id })).toBe(1);
  });

  it('org.member.role.assign — assigning and removing system roles', async () => {
    const { organizationId, admin } = await organizationWithAdmin();
    const member = await signedInMember(app, db, organizationId, ['member']);
    const assigned = await admin.browser.put(`/org/members/${member.membershipId}/roles`, {
      roles: ['member', 'finance'],
    });
    expect(assigned.status).toBe(200);
    expect(await auditCount('org.member.role.assign', { organizationId, targetId: member.membershipId })).toBe(1);
  });

  it('org.member.deactivate, org.member.reactivate — deactivating and reactivating a member', async () => {
    const { organizationId, admin } = await organizationWithAdmin();
    const member = await signedInMember(app, db, organizationId, ['member']);
    expect((await admin.browser.post(`/org/members/${member.membershipId}/deactivate`)).status).toBe(200);
    expect(await auditCount('org.member.deactivate', { organizationId, targetId: member.membershipId })).toBe(1);
    expect((await admin.browser.post(`/org/members/${member.membershipId}/reactivate`)).status).toBe(200);
    expect(await auditCount('org.member.reactivate', { organizationId, targetId: member.membershipId })).toBe(1);
  });

  it('project.member.add, project.member.remove — adding and removing a project member', async () => {
    const { organizationId } = await organizationWithAdmin();
    const { pm, projectId } = await projectOf(organizationId);
    const person = await signedInMember(app, db, organizationId, ['member']);
    const added = await pm.browser.post(`/projects/${projectId}/members`, { membershipId: person.membershipId });
    expect(added.status).toBe(201);
    const projectMemberId: string = added.body.projectMemberId;
    expect(await auditCount('project.member.add', { organizationId })).toBe(1);

    expect((await pm.browser.delete(`/projects/${projectId}/members/${projectMemberId}`)).status).toBe(204);
    expect(await auditCount('project.member.remove', { organizationId })).toBe(1);
  });

  it('project.raci.update, project.accountable.change — assigning RACI and handing over Accountable', async () => {
    const { organizationId } = await organizationWithAdmin();
    const { pm, projectId } = await projectOf(organizationId);
    const other = await signedInMember(app, db, organizationId, ['projectManager']);
    const projectMemberId = await seedProjectMember(db, organizationId, projectId, other.membershipId);

    const raci = await pm.browser.put(`/projects/${projectId}/members/${projectMemberId}/raci`, {
      raciRoles: ['responsible', 'consulted'],
    });
    expect(raci.status).toBe(200);
    expect(await auditCount('project.raci.update', { organizationId })).toBe(1);

    const handover = await pm.browser.put(`/projects/${projectId}/accountable`, { projectMemberId });
    expect(handover.status).toBe(200);
    expect(await auditCount('project.accountable.change', { organizationId, targetId: projectId })).toBe(1);
  });

  it('auth.password-reset.request, auth.password-reset.confirm — requesting and completing a password reset', async () => {
    const { organizationId } = await organizationWithAdmin();
    const person = await signedInMember(app, db, organizationId, ['member']);
    const browser = await new Browser(app).open();
    expect((await browser.post('/auth/password-reset/request', { email: person.email })).status).toBe(202);
    const token = await tokenSentTo(person.email, 'passwordReset');
    await vi.waitFor(async () =>
      expect(await auditCount('auth.password-reset.request', { targetId: person.userId })).toBe(1),
    );

    const confirmed = await browser.post('/auth/password-reset/confirm', { token, newPassword: RESET_PASSWORD });
    expect(confirmed.status).toBe(204);
    expect(await auditCount('auth.password-reset.confirm', { targetId: person.userId })).toBe(1);
  });

  it('denied — a refusal on project data (FR-027 last item)', async () => {
    const { organizationId } = await organizationWithAdmin();
    const { projectId } = await projectOf(organizationId);
    const outsider = await signedInMember(app, db, organizationId, ['projectManager']);
    const refused = await outsider.browser.get(`/projects/${projectId}/members`);
    expect(refused.status).toBe(403);
    const { rows } = await db.ownerPool.query<{ count: string }>(
      "SELECT count(*) FROM audit_entry WHERE outcome = 'denied' AND target_type = 'project' AND target_id = $1",
      [projectId],
    );
    expect(Number(rows[0]!.count)).toBe(1);
  });
});

describe('the audit trail holds no secrets (T121, FR-028, SC-008)', () => {
  it('has no raw password, raw token, token hash, password hash or sensitive value anywhere in audit_entry', async () => {
    // A sensitive write, so its value would show up here if stripping ever failed.
    const { organizationId } = await organizationWithAdmin();
    const { pm, projectId } = await projectOf(organizationId);
    const finance = await signedInMember(app, db, organizationId, ['finance']);
    await pm.browser.post(`/projects/${projectId}/members`, { membershipId: finance.membershipId });
    const write = await finance.browser.put(`/projects/${projectId}/sample-financials`, {
      budgetAtCompletion: SENSITIVE_BUDGET,
    });
    expect(write.status).toBe(200);

    const hashes = await db.ownerPool.query<{ password_hash: string }>('SELECT password_hash FROM app_user');
    const forbidden = [...secrets, ...hashes.rows.map((row) => row.password_hash)].filter((s) => s.length >= 8);
    const { rows } = await db.ownerPool.query<{ entry: string }>(
      'SELECT row_to_json(a)::text AS entry FROM audit_entry a',
    );
    expect(rows.length).toBeGreaterThan(0);
    const leaks = rows.flatMap(({ entry }) => forbidden.filter((secret) => entry.includes(secret)).map(() => entry));
    expect(leaks).toEqual([]);
    for (const { entry } of rows) {
      expect(entry).not.toMatch(/"(password|passwordHash|newPassword|token|tokenHash|budgetAtCompletion)"\s*:/);
    }
  });
});
