import { Body, Controller, Get, HttpCode, Inject, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  LoginRequest,
  SwitchOrganizationRequest,
  type SessionPayload,
} from '@planix/core/features/organization-access/schemas/auth.ts';
import { Public, PublicWithOriginCheck, SessionOnly } from '../../../shared/auth/route-scope.decorators.ts';
import { clearSessionCookie, ensureCsrfCookie, setSessionCookies } from '../../../shared/auth/session-cookie.ts';
import type { AuthenticatedRequest } from '../../../shared/auth/session.guard.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { AuthService } from './auth.service.ts';

/** contracts/api.md §Xác thực và phiên. */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @PublicWithOriginCheck()
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<SessionPayload> {
    const { email, password } = parseBody(LoginRequest, body);
    const signedIn = await this.auth.login(email, password);
    setSessionCookies(res, signedIn.sessionToken, signedIn.csrfToken);
    return signedIn.payload;
  }

  @Post('logout')
  @HttpCode(204)
  @SessionOnly()
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.auth!);
    clearSessionCookie(res);
  }

  @Get('session')
  @Public()
  async session(
    @Req() req: AuthenticatedRequest & Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionPayload> {
    ensureCsrfCookie(req, res);
    if (req.auth === undefined) throw new DomainError('AUTH_REQUIRED');
    return this.auth.session(req.auth.userId, req.auth.activeOrganizationId);
  }

  @Put('session/active-organization')
  @SessionOnly()
  switchOrganization(@Req() req: AuthenticatedRequest, @Body() body: unknown): Promise<SessionPayload> {
    const { organizationId } = parseBody(SwitchOrganizationRequest, body);
    return this.auth.switchOrganization(req.auth!, organizationId);
  }
}
