import { Logger } from '@nestjs/common';

import { prettifyAxiosError } from './axios/axios.logger';

/**
 * Wrapper class for logging operations with consistent format.
 * @internal
 */
export class LogWrapper {
  constructor(
    private readonly logger: Logger,
    private readonly method: string,
    private readonly args: string | number | Record<string, unknown> | undefined,
  ) {}

  invoked(message?: string): void {
    this.logger.log({
      method: this.method,
      state: 'invoked',
      args: this.args,
      ...(message ? { message } : {}),
    });
  }

  success(message?: string): void {
    this.logger.log({
      method: this.method,
      state: 'success',
      args: this.args,
      ...(message ? { message } : {}),
    });
  }

  error(error: unknown, message?: string): void {
    try {
      const pretifiedError = prettifyAxiosError(error)

      this.logger.error({
        method: this.method,
        state: 'error',
        args: this.args,
        error: pretifiedError,
        ...(message ? { message } : {}),
      });
    } catch {
      // failed to log pretified error, log the original error
      this.logger.error({
        method: this.method,
        state: 'error',
        args: this.args,
        error,
        ...(message ? { message } : {}),
      });
    }
  }
}

/**
 * Interface for classes that expose a NestJS Logger instance.
 *
 * Implementing this interface is optional when using the `@Log()` decorator.
 * If a class does not define a `logger` property, the decorator will
 * automatically inject a `new Logger(ClassName)` instance at runtime.
 *
 * You may still implement this interface explicitly to provide a custom logger
 * (e.g., a mock for testing, or a logger with a non-default context).
 */
export interface Loggable {
  logger: Logger;
}

export const isLoggable = (instance: unknown): instance is Loggable => {
  return typeof instance === 'object' && instance !== null && 'logger' in instance;
};

/**
 * Creates a LogWrapper instance for structured method logging.
 *
 * When the target instance already has a `logger` property (i.e., satisfies
 * the {@link Loggable} interface), that logger is used directly. Otherwise,
 * a new `Logger` from `@nestjs/common` is created with `className` as its
 * context and assigned to `instance.logger`, so subsequent calls reuse it.
 *
 * @param instance   - The class instance whose method is being logged
 * @param className  - The name of the class (used as Logger context if auto-injected)
 * @param methodName - The name of the method being logged
 * @param argsObject - Formatted arguments to include in the log entry
 * @returns A configured {@link LogWrapper} ready for invoked/success/error calls
 *
 * @internal
 */
export const createLogWrapper = (
  instance: unknown,
  className: string,
  methodName: string,
  argsObject: string | number | Record<string, unknown> | undefined,
): LogWrapper => {
  if (!isLoggable(instance)) {
    (instance as Record<string, unknown>).logger = new Logger(className);
  }

  return new LogWrapper((instance as Loggable).logger, methodName, argsObject);
};

/**
 * Builds an object mapping parameter names to their values.
 *
 * Creates a record where keys are parameter names and values are the
 * corresponding argument values passed to the function.
 *
 * @param parameterNames - Array of parameter names
 * @param args - Array of argument values
 * @returns Object mapping parameter names to values
 *
 * @example
 * buildArgsObject(['id', 'name'], [1, 'John'])
 * // Returns: { id: 1, name: 'John' }
 *
 * @internal
 */
export const buildArgsObject = (parameterNames: string[], args: unknown[]): Record<string, unknown> | undefined => {
  if (args.length === 0 && parameterNames.length === 0) {
    return undefined;
  }

  const argsObject: Record<string, unknown> = {};

  parameterNames.forEach((paramName, index) => {
    if (index < args.length) {
      argsObject[paramName] = args[index];
    }
  });

  return argsObject;
};
