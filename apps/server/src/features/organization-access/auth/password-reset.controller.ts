import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { PasswordResetConfirm, PasswordResetRequest } from '@planix/core/features/organization-access/schemas/auth.ts';
import { PublicWithOriginCheck } from '../../../shared/auth/route-scope.decorators.ts';
import { parseBody } from '../../../shared/http/parse-body.ts';
import { PasswordResetService } from './password-reset.service.ts';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(@Inject(PasswordResetService) private readonly resets: PasswordResetService) {}

  @Post('request')
  @HttpCode(202)
  @PublicWithOriginCheck()
  async request(@Body() body: unknown): Promise<void> {
    await this.resets.request(parseBody(PasswordResetRequest, body).email);
  }

  @Post('confirm')
  @HttpCode(204)
  @PublicWithOriginCheck()
  async confirm(@Body() body: unknown): Promise<void> {
    const { token, newPassword } = parseBody(PasswordResetConfirm, body);
    await this.resets.confirm(token, newPassword);
  }
}
