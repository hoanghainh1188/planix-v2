import type { RaciRole, SystemRole } from './roles.ts';

/**
 * Phase-1 permission matrix — contracts/authorization.md §1, decisions
 * 2026-09-14-005-phase1-permission-matrix and 2026-09-15-005-portfolio-lead-manages-project-members.
 */
export const PERMISSION_MATRIX = {
  'org.member.invite': { scope: 'org', roles: ['admin'] },
  'org.member.role.assign': { scope: 'org', roles: ['admin'] },
  'org.member.deactivate': { scope: 'org', roles: ['admin'] },
  'org.member.reactivate': { scope: 'org', roles: ['admin'] },
  'org.member.read': {
    scope: 'org',
    roles: ['admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance'],
  },
  'project.create': { scope: 'org', roles: ['portfolioLead', 'projectManager'] },
  'project.list': {
    scope: 'org',
    roles: ['admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance'],
  },
  'project.read': {
    scope: 'project',
    roles: ['admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance'],
  },
  'project.member.manage': { scope: 'project', roles: ['portfolioLead', 'projectManager'] },
  'project.raci.manage': { scope: 'project', roles: ['projectManager'] },
  'module.task.access': { scope: 'project', roles: ['portfolioLead', 'projectManager', 'functionalManager', 'member'] },
  'module.wbs.access': { scope: 'project', roles: ['portfolioLead', 'projectManager', 'functionalManager', 'member'] },
  'module.schedule.access': {
    scope: 'project',
    roles: ['portfolioLead', 'projectManager', 'functionalManager', 'member'],
  },
  'module.resource.access': { scope: 'project', roles: ['portfolioLead', 'projectManager', 'functionalManager'] },
  'sensitive.financial.read': { scope: 'project', roles: ['portfolioLead', 'projectManager', 'finance'] },
  'sensitive.financial.write': { scope: 'project', roles: ['portfolioLead', 'projectManager', 'finance'] },
} as const satisfies Record<string, PermissionEntry>;

export interface PermissionEntry {
  readonly scope: 'org' | 'project';
  readonly roles: readonly SystemRole[];
  readonly requiresRaci?: readonly RaciRole[];
}

export type Action = keyof typeof PERMISSION_MATRIX;

export type PermissionMatrix = Readonly<Record<Action, PermissionEntry>>;

export const ACTIONS = Object.keys(PERMISSION_MATRIX) as readonly Action[];
