import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  AcceptInvitationRequest,
  type SessionPayload,
} from '@planix/core/features/organization-access/schemas/auth.ts';
import { Public, PublicWithOriginCheck } from '../../../shared/auth/route-scope.decorators.ts';
import { setSessionCookies } from '../../../shared/auth/session-cookie.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { InvitationService, type InvitationDescription } from './invitation.service.ts';

/** contracts/api.md §Lời mời — token-based routes. */
@Controller('invitations/:token')
export class AcceptInvitationController {
  constructor(@Inject(InvitationService) private readonly invitations: InvitationService) {}

  @Get()
  @Public()
  describe(@Param('token') token: string): Promise<InvitationDescription> {
    return this.invitations.describe(token);
  }

  @Post('accept')
  @HttpCode(200)
  @PublicWithOriginCheck()
  async accept(
    @Param('token') token: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionPayload> {
    const { password } = parseBody(AcceptInvitationRequest, body);
    const accepted = await this.invitations.accept(token, password, req.auth);
    if (accepted.newSession !== undefined) {
      setSessionCookies(res, accepted.newSession.sessionToken, accepted.newSession.csrfToken);
    }
    return accepted.payload;
  }
}
