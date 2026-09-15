import { Body, Controller, Inject, Patch, Req } from '@nestjs/common';
import { UpdateMeRequest, type SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { SessionOnly } from '../../../shared/auth/route-scope.decorators.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { AuthService } from './auth.service.ts';

/** contracts/api.md §Xác thực — the signed-in user's own preferences (FR-029, FR-030). No organization needed. */
@Controller('me')
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Patch()
  @SessionOnly()
  update(@Req() req: AuthenticatedRequest, @Body() body: unknown): Promise<SessionPayload> {
    return this.auth.updatePreferences(req.auth!, parseBody(UpdateMeRequest, body));
  }
}
