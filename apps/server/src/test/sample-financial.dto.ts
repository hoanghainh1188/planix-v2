import { z } from 'zod';
import { sensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';

/**
 * TEST-ONLY DTO proving the sensitive field mechanism (FR-026). Never import from production code:
 * real sensitive fields arrive with RES (billingRate) and EVM (budgetAtCompletion).
 */
export const SampleFinancialDto = z.object({
  name: z.string(),
  budgetAtCompletion: sensitive('sensitive.financial.read', 'sensitive.financial.write')(z.string()),
});
export type SampleFinancialDto = z.infer<typeof SampleFinancialDto>;

export const SampleFinancialList = z.object({ items: z.array(SampleFinancialDto) });

export const SampleFinancialUpdate = SampleFinancialDto.partial();
