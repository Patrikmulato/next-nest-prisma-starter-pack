type Loggable = {
  debug: (context: string, message: string, meta?: Record<string, unknown>) => void;
  error: (context: string, message: string, meta?: Record<string, unknown>) => void;
};

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'then' in value &&
    typeof (value as { then: unknown }).then === 'function'
  );
}

export function LogExecution(context?: string) {
  return <T extends (...args: unknown[]) => unknown>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> => {
    const original = descriptor.value;
    if (typeof original !== 'function') {
      return descriptor;
    }

    const wrapped: T = function (this: unknown, ...args: Parameters<T>) {
      const logger = (this as { logger?: Loggable }).logger;
      const method = String(propertyKey);
      const logContext = context ?? target.constructor?.name ?? 'UnknownContext';

      logger?.debug(logContext, 'Method started', {
        method,
      });

      try {
        const result = original.apply(this, args);

        if (isPromiseLike(result)) {
          return result
            .then((value) => {
              logger?.debug(logContext, 'Method finished', { method });
              return value;
            })
            .catch((error: unknown) => {
              logger?.error(logContext, 'Method failed', {
                method,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            });
        }

        logger?.debug(logContext, 'Method finished', { method });
        return result;
      } catch (error: unknown) {
        logger?.error(logContext, 'Method failed', {
          method,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } as T;

    descriptor.value = wrapped;
    return descriptor;
  };
}
