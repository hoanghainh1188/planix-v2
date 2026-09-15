import { SetMetadata } from '@nestjs/common';
import type { z } from 'zod';

export const RESPONSE_SCHEMA = 'planix:response-schema';
export const REQUEST_SCHEMA = 'planix:request-schema';

/** Schema of the response body; its sensitive fields are removed for callers lacking the read permission. */
export const ResponseSchema = (schema: z.ZodType) => SetMetadata(RESPONSE_SCHEMA, schema);

/** Schema of the request body; writing a sensitive field without the write permission is rejected with 403. */
export const RequestSchema = (schema: z.ZodType) => SetMetadata(REQUEST_SCHEMA, schema);
