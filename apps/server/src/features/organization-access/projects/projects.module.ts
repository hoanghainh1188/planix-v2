import { Module } from '@nestjs/common';
import { ProjectMembersController } from './project-members.controller.ts';
import { ProjectMembersService } from './project-members.service.ts';
import { ProjectsController } from './projects.controller.ts';
import { PROJECTS_REPOSITORY, ProjectsRepository } from './projects.repository.ts';
import { ProjectsService } from './projects.service.ts';

/** Projects and project members (US4). */
@Module({
  controllers: [ProjectsController, ProjectMembersController],
  providers: [
    ProjectsService,
    ProjectMembersService,
    { provide: PROJECTS_REPOSITORY, useValue: new ProjectsRepository() },
  ],
})
export class ProjectsModule {}
