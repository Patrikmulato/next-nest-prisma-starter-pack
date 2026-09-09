import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/index.js';

type DatabaseConnectionConfig = {
  connectionString: string;
  shouldConnect: boolean;
};

const FALLBACK_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/postgres?sslmode=require';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly shouldConnect: boolean;

  constructor() {
    const { connectionString, shouldConnect } = PrismaService.resolveDatabaseConnection();

    super({ adapter: new PrismaPg({ connectionString }) });

    this.shouldConnect = shouldConnect;
  }

  private static resolveDatabaseConnection(): DatabaseConnectionConfig {
    if (process.env.DATABASE_URL) {
      return {
        connectionString: process.env.DATABASE_URL,
        shouldConnect: true,
      };
    }

    // Tests and ad-hoc scripts may not preload dotenv.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv/config');

    if (process.env.DATABASE_URL) {
      return {
        connectionString: process.env.DATABASE_URL,
        shouldConnect: true,
      };
    }

    if (process.env.NODE_ENV === 'test') {
      return {
        connectionString: FALLBACK_DATABASE_URL,
        shouldConnect: false,
      };
    }

    throw new Error('DATABASE_URL is required');
  }

  async onModuleInit() {
    if (this.shouldConnect) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    if (this.shouldConnect) {
      await this.$disconnect();
    }
  }
}
