import 'reflect-metadata';
import { Controller, Get, Module, Put } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import { RequestSchema, ResponseSchema } from './sensitive-field.decorators.ts';
import { SensitiveSchemaCoverage } from './sensitive-schema-coverage.ts';

const financial = sensitive('sensitive.financial.read', 'sensitive.financial.write');
const TreeNode: z.ZodType = z.lazy(() => z.object({ budgetAtCompletion: financial(z.string()) }));

@Controller('unsupported')
class UnsupportedController {
  @Get()
  @ResponseSchema(z.object({ tree: TreeNode }))
  read() {
    return {};
  }

  @Put()
  @RequestSchema(z.object({ pair: z.tuple([financial(z.string())]) }))
  write() {
    return {};
  }
}

@Controller('supported')
class SupportedController {
  @Get()
  @ResponseSchema(z.object({ budgetAtCompletion: financial(z.string()), lines: z.array(z.object({ a: z.string() })) }))
  read() {
    return {};
  }
}

async function start(controllers: Array<new () => unknown>) {
  @Module({ imports: [DiscoveryModule], controllers, providers: [SensitiveSchemaCoverage] })
  class ProbeModule {}
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  return { app, init: () => app.init() };
}

describe('sensitive schemas must be fully inspectable at start-up (security review item 2)', () => {
  it('refuses to start when a declared request or response schema contains lazy, tuple, intersection or map', async () => {
    const { app, init } = await start([UnsupportedController]);
    await expect(init()).rejects.toThrow(/GET \/unsupported: tree \(lazy\).*PUT \/unsupported: pair \(tuple\)/s);
    await app.close();
  });

  it('starts when every declared schema is supported', async () => {
    const { app, init } = await start([SupportedController]);
    await expect(init()).resolves.toBeDefined();
    await app.close();
  });
});
