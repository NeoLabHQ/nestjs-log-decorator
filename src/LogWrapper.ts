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

  invoked(): void {
    this.logger.log({
      method: this.method,
      state: 'invoked',
      args: this.args,
    });
  }

  success(): void {
    this.logger.log({
      method: this.method,
      state: 'success',
      args: this.args,
    });
  }

  error(error: unknown): void {
    this.logger.error({
      method: this.method,
      state: 'error',
      args: this.args,
      error: prettifyAxiosError(error),
    });
  }
}

/** If you see it, then you probably forgot to add `readonly logger = new Logger(YourClass.name)` to your class */
export interface Loggable {
  logger: Logger;
}

export const isLoggable = (instance: unknown): instance is Loggable => {
  return typeof instance === 'object' && instance !== null && 'logger' in instance;
};

/**
 * Creates a LogWrapper instance with validated logger and built args object.
 * @internal
 */
export const createLogWrapper = (
  instance: unknown,
  className: string,
  methodName: string,
  argsObject: string | number | Record<string, unknown> | undefined,
): LogWrapper => {
  // Validate logger exists
  if (!isLoggable(instance)) {
    throw new Error(`Logger not found in ${className}. Please add: readonly logger = new Logger(${className}.name)`);
  }

  return new LogWrapper(instance.logger, methodName, argsObject);
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
