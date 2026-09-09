import { Injectable } from '@nestjs/common';
import { getCorrelationId } from './correlation-context.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

@Injectable()
export class LoggerService {
  debug(context: string, message: string, meta?: LogMeta): void {
    this.write('debug', context, message, meta);
  }

  log(context: string, message: string, meta?: LogMeta): void {
    this.write('info', context, message, meta);
  }

  warn(context: string, message: string, meta?: LogMeta): void {
    this.write('warn', context, message, meta);
  }

  error(context: string, message: string, meta?: LogMeta): void {
    this.write('error', context, message, meta);
  }

  private write(level: LogLevel, context: string, message: string, meta?: LogMeta): void {
    const isTestEnv = process.env.NODE_ENV === 'test';
    if (isTestEnv && level !== 'error') {
      return;
    }

    const event: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: getCorrelationId(),
      context,
      message,
      ...(meta ?? {}),
    };

    const line = JSON.stringify(event);
    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
