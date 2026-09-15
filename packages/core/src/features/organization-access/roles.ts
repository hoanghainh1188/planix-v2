/** System roles held through an organization membership (glossary: Organization Membership, Membership Role). */
export const SYSTEM_ROLES = [
  'admin',
  'portfolioLead',
  'projectManager',
  'functionalManager',
  'member',
  'finance',
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** RACI roles held by a project member (glossary: RACI Matrix). */
export const RACI_ROLES = ['responsible', 'accountable', 'consulted', 'informed'] as const;
export type RaciRole = (typeof RACI_ROLES)[number];
