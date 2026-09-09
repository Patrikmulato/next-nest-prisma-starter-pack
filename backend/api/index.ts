import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app-setup.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedFastify: any = null;

async function getHandler() {
  if (cachedFastify) {
    return cachedFastify;
  }

  const adapter = new FastifyAdapter();
  const nestApp = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  setupApp(nestApp, { withGlobalPrefix: true });
  await nestApp.init();

  const fastify = adapter.getInstance();
  await fastify.ready();

  cachedFastify = fastify;
  return cachedFastify;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const fastify = await getHandler();
  fastify.server.emit('request', req, res);
}
