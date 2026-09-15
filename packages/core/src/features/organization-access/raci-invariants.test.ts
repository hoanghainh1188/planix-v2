import { describe, expect, it } from 'vitest';
import { hasExactlyOneAccountable, planAccountableTransfer, replaceRaciRoles } from './raci-invariants.ts';

describe('RACI invariants (FR-020, decision single-accountable-per-project)', () => {
  describe('replacing responsible/consulted/informed', () => {
    it('lets a member hold several RACI roles, in canonical order, without duplicates', () => {
      expect(replaceRaciRoles(new Set(), ['informed', 'responsible', 'informed'])).toEqual({
        ok: true,
        raciRoles: ['responsible', 'informed'],
      });
    });

    it('keeps the Accountable role of the current Accountable', () => {
      expect(replaceRaciRoles(new Set(['accountable', 'consulted']), ['responsible'])).toEqual({
        ok: true,
        raciRoles: ['responsible', 'accountable'],
      });
    });

    it('allows clearing all of R/C/I', () => {
      expect(replaceRaciRoles(new Set(['responsible']), [])).toEqual({ ok: true, raciRoles: [] });
    });

    it('never grants or removes Accountable through this path', () => {
      expect(replaceRaciRoles(new Set(), ['accountable'])).toEqual({ ok: false, code: 'VALIDATION_FAILED' });
    });
  });

  describe('changing the Accountable', () => {
    it('replaces the Accountable in one step', () => {
      expect(
        planAccountableTransfer({ accountableProjectMemberId: 'pm-1' }, { projectMemberId: 'pm-2', status: 'active' }),
      ).toEqual({ ok: true, previousProjectMemberId: 'pm-1', currentProjectMemberId: 'pm-2', changed: true });
    });

    it('is a no-op when the candidate already is the Accountable', () => {
      expect(
        planAccountableTransfer({ accountableProjectMemberId: 'pm-1' }, { projectMemberId: 'pm-1', status: 'active' }),
      ).toMatchObject({ ok: true, changed: false });
    });

    it('refuses a candidate who is not an active project member', () => {
      for (const status of ['removed', 'none'] as const) {
        expect(
          planAccountableTransfer({ accountableProjectMemberId: 'pm-1' }, { projectMemberId: 'pm-2', status }),
        ).toEqual({ ok: false, code: 'NOT_PROJECT_MEMBER' });
      }
    });
  });

  describe('exactly one Accountable', () => {
    it('holds only with exactly one accountable assignment', () => {
      expect(hasExactlyOneAccountable([{ raciRole: 'accountable' }, { raciRole: 'responsible' }])).toBe(true);
      expect(hasExactlyOneAccountable([{ raciRole: 'responsible' }])).toBe(false);
      expect(hasExactlyOneAccountable([{ raciRole: 'accountable' }, { raciRole: 'accountable' }])).toBe(false);
    });
  });
});
