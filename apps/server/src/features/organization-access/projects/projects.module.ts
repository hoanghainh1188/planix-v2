import { Module } from '@nestjs/common';
import { ACCOUNTABLE_QUERY, AccountableQuery } from './accountable.query.ts';
import { ProjectMembersController } from './project-members.controller.ts';
import { ProjectMembersService } from './project-members.service.ts';
import { ProjectsController } from './projects.controller.ts';
import { PROJECTS_REPOSITORY, ProjectsRepository } from './projects.repository.ts';
import { ProjectsService } from './projects.service.ts';
import { RaciController } from './raci.controller.ts';
import { RaciService } from './raci.service.ts';

/** Projects, project members and RACI (US4, US5). Exports AccountableQuery for later features (OI-07). */
@Module({
  controllers: [ProjectsController, ProjectMembersController, RaciController],
  providers: [
    ProjectsService,
    ProjectMembersService,
    RaciService,
    { provide: PROJECTS_REPOSITORY, useValue: new ProjectsRepository() },
    { provide: ACCOUNTABLE_QUERY, useValue: new AccountableQuery() },
  ],
  exports: [ACCOUNTABLE_QUERY],
})
export class ProjectsModule {}
