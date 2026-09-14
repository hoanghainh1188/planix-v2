import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACTIONS, PERMISSION_MATRIX } from './permission-matrix.ts';
import { SYSTEM_ROLES, type SystemRole } from './roles.ts';

const CONTRACT = fileURLToPath(
  new URL('../../../../../specs/20260914-224646-organization-access/contracts/authorization.md', import.meta.url),
);

interface ContractRow {
  action: string;
  scope: string;
  roles: SystemRole[];
}

function contractMatrix(): ContractRow[] {
  const section = readFileSync(CONTRACT, 'utf8').split('## 1.')[1]?.split('## 2.')[0] ?? '';
  const lines = section.split('\n').filter((l) => l.startsWith('| `'));
  return lines.map((line) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const [action = '', scope = '', ...roleCells] = cells;
    return {
      action: action.replaceAll('`', ''),
      scope,
      roles: SYSTEM_ROLES.filter((_, i) => roleCells[i] === '✓'),
    };
  });
}

describe('permission matrix (FR-011, FR-013)', () => {
  it('declares the six system roles in contract column order', () => {
    expect(SYSTEM_ROLES).toEqual([
      'admin',
      'portfolioLead',
      'projectManager',
      'functionalManager',
      'member',
      'finance',
    ]);
  });

  it('has exactly the 16 actions of contracts/authorization.md §1', () => {
    const rows = contractMatrix();
    expect(rows).toHaveLength(16);
    expect([...ACTIONS].sort()).toEqual(rows.map((r) => r.action).sort());
  });

  it('matches scope and allowed roles for every action', () => {
    for (const row of contractMatrix()) {
      const entry = PERMISSION_MATRIX[row.action as keyof typeof PERMISSION_MATRIX];
      expect(entry, row.action).toBeDefined();
      expect(entry.scope, row.action).toBe(row.scope);
      expect([...entry.roles].sort(), row.action).toEqual([...row.roles].sort());
    }
  });

  it('lets portfolio leads manage project members but only project managers manage RACI (decision 2026-09-15)', () => {
    expect([...PERMISSION_MATRIX['project.member.manage'].roles].sort()).toEqual(['portfolioLead', 'projectManager']);
    expect(PERMISSION_MATRIX['project.raci.manage'].roles).toEqual(['projectManager']);
  });

  it('gives admin no project-scope action beyond reading (FR-016 relies on project membership)', () => {
    const adminProjectActions = ACTIONS.filter(
      (a) =>
        PERMISSION_MATRIX[a].scope === 'project' &&
        (PERMISSION_MATRIX[a].roles as readonly SystemRole[]).includes('admin'),
    );
    expect(adminProjectActions).toEqual(['project.read']);
  });
});
