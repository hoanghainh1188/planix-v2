import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.ts';
import { AuthService } from './auth/auth.service.ts';
import { PasswordResetController } from './auth/password-reset.controller.ts';
import { PasswordResetService } from './auth/password-reset.service.ts';
import { AcceptInvitationController } from './invitations/accept-invitation.controller.ts';
import { INVITATION_REPOSITORY, InvitationRepository } from './invitations/invitation.repository.ts';
import { InvitationService } from './invitations/invitation.service.ts';
import { PlatformController } from './platform/platform.controller.ts';
import { PlatformService } from './platform/platform.service.ts';

/** Feature 005 organization-access: accounts, sessions, invitations, platform operator. */
@Module({
  controllers: [AuthController, PasswordResetController, AcceptInvitationController, PlatformController],
  providers: [
    AuthService,
    PasswordResetService,
    InvitationService,
    PlatformService,
    { provide: INVITATION_REPOSITORY, useValue: new InvitationRepository() },
  ],
})
export class OrganizationAccessModule {}
