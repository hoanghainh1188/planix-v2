import { z } from 'zod';
import type { RaciRole } from '../roles.ts';

/** Request/response contracts for projects and project members (contracts/api.md §Dự án, thành viên dự án, RACI). */
export const CreateProjectRequest = z.object({
  // data-model: name "NOT NULL, 1–200 ký tự"; description "NULL, ≤ 5.000 ký tự"
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

export const AddProjectMemberRequest = z.object({ membershipId: z.uuid() });
export type AddProjectMemberRequest = z.infer<typeof AddProjectMemberRequest>;

export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'active' | 'archived';
  readonly createdAt: string;
}

export interface AccountableView {
  readonly projectMemberId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
}

export interface ProjectDetail {
  readonly project: ProjectView;
  readonly accountable: AccountableView;
}

export interface ProjectMemberView {
  readonly projectMemberId: string;
  readonly membershipId: string;
  readonly email: string;
  readonly raciRoles: readonly RaciRole[];
}
