import { Body, Controller, Get, Inject, Injectable, Module, Param, Put, Req } from '@nestjs/common';
import { Decimal } from '@planix/core/shared/decimal/decimal.ts';
import { AUDIT_WRITER, type AuditWriter } from '../shared/audit/audit-writer.ts';
import type { AuthenticatedRequest } from '../shared/auth/session.guard.ts';
import { RequireAction } from '../shared/authorization/require-action.decorator.ts';
import { requireRequestTransaction } from '../shared/db/request-transaction.ts';
import { DomainError, type ErrorParams } from '../shared/errors/domain-error.ts';
import { parseBody } from '../shared/http/parse-body.ts';
import { RequestSchema, ResponseSchema } from '../shared/sensitive-field/sensitive-field.decorators.ts';
import { SampleFinancialDto, SampleFinancialList, SampleFinancialUpdate } from './sample-financial.dto.ts';

/** In-memory data for the sample (no production table or migration). */
@Injectable()
export class SampleFinancialStore {
  readonly #byProject = new Map<string, SampleFinancialDto>();

  get(projectId: string): SampleFinancialDto {
    return this.#byProject.get(projectId) ?? { name: 'Sample', budgetAtCompletion: '1000.0000' };
  }

  set(projectId: string, value: SampleFinancialDto): void {
    this.#byProject.set(projectId, value);
  }
}

/**
 * TEST-ONLY routes proving the shared sensitive-field mechanism end to end (US7, Q15). Attached only through
 * createTestApp({ extraModules }); the production AppModule never imports this module.
 */
@Controller('projects/:projectId/sample-financials')
class SampleFinancialController {
  constructor(
    @Inject(SampleFinancialStore) private readonly store: SampleFinancialStore,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  @Get()
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  detail(@Param('projectId') projectId: string): SampleFinancialDto {
    return this.store.get(projectId);
  }

  @Get('list')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialList)
  list(@Param('projectId') projectId: string) {
    const sample = this.store.get(projectId);
    return { items: [sample, { ...sample, name: `${sample.name} (copy)` }] };
  }

  @Get('error')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  failing(@Param('projectId') projectId: string): never {
    throw new DomainError('VALIDATION_FAILED', { ...this.store.get(projectId) });
  }

  /** Returns a "raw row" with a column the response schema does not declare (security review item 1). */
  @Get('raw')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  raw(@Param('projectId') projectId: string) {
    return { ...this.store.get(projectId), internalCostBasis: '750.0000' };
  }

  /** An error carrying a whole row in its params next to legitimate primitive params. */
  @Get('error-with-row')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  failingWithRow(@Param('projectId') projectId: string): never {
    const params = { projectIds: [projectId], row: { ...this.store.get(projectId) } };
    throw new DomainError('ACCOUNTABLE_REQUIRED', params as unknown as ErrorParams);
  }

  @Put()
  @RequireAction('project.read')
  @RequestSchema(SampleFinancialUpdate)
  @ResponseSchema(SampleFinancialDto)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ): Promise<SampleFinancialDto> {
    const input = parseBody(SampleFinancialUpdate, body);
    const before = this.store.get(projectId);
    let budgetAtCompletion = before.budgetAtCompletion;
    if (input.budgetAtCompletion !== undefined) {
      try {
        budgetAtCompletion = Decimal.of(input.budgetAtCompletion).toString();
      } catch {
        throw new DomainError('VALIDATION_FAILED');
      }
    }
    const after: SampleFinancialDto = { name: input.name ?? before.name, budgetAtCompletion };
    await this.audit.record(requireRequestTransaction(req), {
      organizationId: req.principal!.organizationId,
      actorUserId: req.principal!.userId,
      actorKind: 'user',
      action: 'sample.financial.update',
      targetType: 'project',
      targetId: projectId,
      outcome: 'succeeded',
      before,
      after,
      snapshotSchema: SampleFinancialDto,
    });
    this.store.set(projectId, after);
    return after;
  }
}

@Module({ controllers: [SampleFinancialController], providers: [SampleFinancialStore] })
export class SampleFinancialModule {}
