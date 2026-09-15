import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.ts';
import { AuthService } from './auth/auth.service.ts';
import { PasswordResetController } from './auth/password-reset.controller.ts';
import { PasswordResetService } from './auth/password-reset.service.ts';
import { AcceptInvitationController } from './invitations/accept-invitation.controller.ts';
import {
  INVITATION_REPOSITORY,
  InvitationRepository,
  ORGANIZATION_INVITATION_REPOSITORY,
  OrganizationInvitationRepository,
} from './invitations/invitation.repository.ts';
import { InvitationService } from './invitations/invitation.service.ts';
import { OrganizationInvitationsController } from './invitations/org-invitations.controller.ts';
import { MembersModule } from './members/members.module.ts';
import { ProjectsModule } from './projects/projects.module.ts';
import { PlatformController } from './platform/platform.controller.ts';
import { PlatformService } from './platform/platform.service.ts';

/** Feature 005 organization-access: accounts, sessions, invitations, members, projects, platform operator. */
@Module({
  imports: [MembersModule, ProjectsModule],
  controllers: [
    AuthController,
    PasswordResetController,
    AcceptInvitationController,
    OrganizationInvitationsController,
    PlatformController,
  ],
  providers: [
    AuthService,
    PasswordResetService,
    InvitationService,
    PlatformService,
    { provide: INVITATION_REPOSITORY, useValue: new InvitationRepository() },
    { provide: ORGANIZATION_INVITATION_REPOSITORY, useValue: new OrganizationInvitationRepository() },
  ],
})
export class OrganizationAccessModule {}
