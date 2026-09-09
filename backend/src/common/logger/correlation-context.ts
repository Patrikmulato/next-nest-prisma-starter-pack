import { AsyncLocalStorage } from 'node:async_hooks';

type CorrelationStore = {
  correlationId: string;
};

const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export function runWithCorrelationId<T>(correlationId: string, callback: () => T): T {
  return correlationStorage.run({ correlationId }, callback);
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
