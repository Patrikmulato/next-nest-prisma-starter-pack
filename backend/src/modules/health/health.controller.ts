import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Liveness: cheap, never touches the database.
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: verifies the database so uptime probes / smoke tests fail
  // correctly when the DB is unreachable.
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'down' });
    }

    return {
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
