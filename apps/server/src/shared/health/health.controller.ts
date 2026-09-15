import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../auth/route-scope.decorators.ts';

/**
 * Liveness check for the hosting platform (decision 2026-09-15-018-demo-deploy). It deliberately does not touch the
 * database: frequent platform probes would otherwise keep a scale-to-zero database awake.
 */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
