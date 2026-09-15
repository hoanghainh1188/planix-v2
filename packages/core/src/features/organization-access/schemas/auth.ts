import { z } from 'zod';

/** Request/response contracts shared by server and web (contracts/api.md §Xác thực, §Lời mời, §Platform). */
const email = z.email().max(254);

export const LoginRequest = z.object({ email, password: z.string().min(1).max(1024) });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SwitchOrganizationRequest = z.object({ organizationId: z.uuid() });
export type SwitchOrganizationRequest = z.infer<typeof SwitchOrganizationRequest>;

export const AcceptInvitationRequest = z.object({ password: z.string().max(1024).optional() });
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequest>;

export const PasswordResetRequest = z.object({ email });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordResetConfirm = z.object({ token: z.string().min(1).max(256), newPassword: z.string().max(1024) });
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirm>;

export const CreateOrganizationRequest = z.object({ name: z.string().trim().min(1).max(200), firstAdminEmail: email });
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequest>;

export const AdminInvitationRequest = z.object({ email });
export type AdminInvitationRequest = z.infer<typeof AdminInvitationRequest>;

const TIME_ZONE_MAX_LENGTH = 100;

/** `UTC` or an IANA `Area/Location[/Sub]` name with its official capitalization. */
const IANA_NAME = /^(UTC|[A-Z][A-Za-z]*(\/[A-Z][A-Za-z0-9_+-]*)+)$/;

/**
 * An IANA time zone name the runtime knows, spelled as IANA does: `UTC` or `Area/Location` (e.g.
 * `Asia/Ho_Chi_Minh`). Refuses offsets (`UTC+7`), abbreviations (`GMT`, `Zulu`), `Etc/*` and wrong capitalization.
 * The name is stored as sent — never replaced by the runtime's ICU alias (`Asia/Ho_Chi_Minh` → `Asia/Saigon`
 * depends on the Node/ICU version).
 */
export function isIanaTimeZone(value: string): boolean {
  // Length first: zod runs refinements even after .max() fails, so this keeps long input away from regex and Intl.
  if (value.length > TIME_ZONE_MAX_LENGTH || !IANA_NAME.test(value) || value.startsWith('Etc/')) return false;
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  // Same zone spelled with other capitalization (e.g. ASIA/TOKYO → Asia/Tokyo) is refused; aliases are fine.
  return !(resolved.toLowerCase() === value.toLowerCase() && resolved !== value);
}

export const UpdateMeRequest = z.object({
  locale: z.enum(['vi', 'en']).optional(),
  timeZone: z.string().max(TIME_ZONE_MAX_LENGTH).refine(isIanaTimeZone).optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

export interface SessionMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: 'active' | 'deactivated';
  readonly roles: readonly string[];
}

export interface SessionPayload {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly locale: 'vi' | 'en';
    readonly timeZone: string;
  };
  readonly memberships: readonly SessionMembership[];
  readonly activeOrganizationId: string | null;
}

/** Login auto-selection (contracts/api.md): one active membership, else the last active one if still active. */
export function chooseActiveOrganization(
  memberships: readonly SessionMembership[],
  lastActiveOrganizationId: string | null,
): string | null {
  const active = memberships.filter((m) => m.status === 'active');
  if (active.length === 1) return active[0]!.organizationId;
  if (lastActiveOrganizationId !== null && active.some((m) => m.organizationId === lastActiveOrganizationId)) {
    return lastActiveOrganizationId;
  }
  return null;
}
