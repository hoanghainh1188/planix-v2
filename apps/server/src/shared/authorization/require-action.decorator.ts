import { SetMetadata, applyDecorators } from '@nestjs/common';
import type { Action } from '@planix/core/features/organization-access/permission-matrix.ts';
import { OrganizationScoped } from '../auth/route-scope.decorators.ts';

export const REQUIRED_ACTION = 'planix:required-action';

export interface RequiredAction {
  readonly action: Action;
  /** Route parameter holding the project id for project-scope actions. */
  readonly projectParam: string;
}

/** Declares the single action a route performs; implies an organization-scoped tenant transaction. */
export const RequireAction = (action: Action, options: { projectParam?: string } = {}) =>
  applyDecorators(
    SetMetadata(REQUIRED_ACTION, {
      action,
      projectParam: options.projectParam ?? 'projectId',
    } satisfies RequiredAction),
    OrganizationScoped(),
  );
