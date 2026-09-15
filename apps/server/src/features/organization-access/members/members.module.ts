import { Module } from '@nestjs/common';
import { MembersController } from './members.controller.ts';
import { MEMBERS_REPOSITORY, MembersRepository } from './members.repository.ts';
import { MembersService } from './members.service.ts';

/** Organization members and system roles (US3). */
@Module({
  controllers: [MembersController],
  providers: [MembersService, { provide: MEMBERS_REPOSITORY, useValue: new MembersRepository() }],
})
export class MembersModule {}
