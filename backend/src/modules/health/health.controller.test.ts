import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  it('check() reports liveness without touching the database', () => {
    const controller = new HealthController({} as PrismaService);

    const result = controller.check();

    assert.equal(result.status, 'ok');
  });

  it('ready() reports the database as up when the query succeeds', async () => {
    const prisma = { $queryRaw: async () => [{ ok: 1 }] } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    const result = await controller.ready();

    assert.equal(result.status, 'ok');
    assert.equal(result.db, 'up');
  });

  it('ready() throws 503 when the database is unreachable', async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error('connection refused');
      },
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    await assert.rejects(() => controller.ready(), ServiceUnavailableException);
  });
});
