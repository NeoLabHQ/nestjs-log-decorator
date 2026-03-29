import { Logger } from '@nestjs/common';

import { Effect, EffectOnMethod, SetMeta } from './decorators';
import type { EffectHooks } from './decorators';
import { buildArgsObject, createLogWrapper } from './LogWrapper';
import { type LogOptions, NO_LOG_METADATA_KEY } from './types';

/**
 * Symbol used to cache the auto-created Logger instance on instances.
 * @internal
 */
const LOGGER_CACHE_KEY = Symbol('loggerCache');

/**
 * Extracts parameter names from a function signature.
 *
 * This function parses the function's string representation to extract
 * parameter names, handling TypeScript type annotations and default values.
 *
 * @param func - The function to extract parameter names from
 * @returns Array of parameter names
 *
 * @example
 * function example(id: number, name: string = 'default') {}
 * getParameterNames(example) // Returns: ['id', 'name']
 *
 * @internal
 */
const getParameterNames = (func: (...args: unknown[]) => unknown): string[] => {
  const funcStr = func.toString();
  const match = funcStr.match(/\(([^)]*)\)/);

  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map(param => param.trim().split(/[=:]/)[0].trim())
    .filter(param => param.length > 0);
};

/**
 * Injects a lazy Logger getter/setter onto the target class prototype.
 *
 * When a class decorated with `@Log()` does not define its own `logger`
 * property, this function defines a prototype getter that lazily creates
 * a `Logger` instance using `this.constructor.name` as the context. The
 * created logger is cached on the instance via a symbol key.
 *
 * If the class already defines a `logger` property on its prototype, this
 * function returns early without modification. User-defined class fields
 * (e.g., `readonly logger = new Logger(...)`) take precedence because
 * they become own-properties on the instance, shadowing the prototype
 * getter.
 *
 * @param target - The class constructor to inject the logger onto
 *
 * @internal
 */
const injectLoggerIfMissing = (target: Function): void => {
  // If prototype already has a logger property (getter or value), skip
  const prototype = target.prototype as Record<string, unknown>;
  if ('logger' in prototype) return;

  Object.defineProperty(prototype, 'logger', {
    get: function (this: Record<string | symbol, unknown>): Logger {
      // Check for cached logger on this instance
      const cached = this[LOGGER_CACHE_KEY] as Logger | undefined;
      if (cached) return cached;

      // Create new logger with class name as context
      const className = (this.constructor as { name: string }).name ?? '';
      const logger = new Logger(className);

      // Cache on instance for reuse
      Object.defineProperty(this, LOGGER_CACHE_KEY, {
        value: logger,
        writable: false,
        enumerable: false,
        configurable: true,
      });

      return logger;
    },
    set: function (this: Record<string | symbol, unknown>, value: Logger): void {
      // Allow user-defined logger to override via own-property
      Object.defineProperty(this, 'logger', {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
    enumerable: false,
    configurable: true,
  });
};

/**
 * Decorator function that can be applied to classes or methods.
 * Uses overloads to provide type checking for class decorators while
 * keeping method decorators flexible.
 */
interface LogDecorator {
  /**
   * Class decorator - applies logging to all methods in the class.
   * The class no longer needs to define a `logger` property; one will
   * be auto-injected if missing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends new (...args: any[]) => unknown>(target: T): T;
  /**
   * Method decorator - no compile-time constraint on `this`.
   * Wraps only the specific method with logging.
   */
  (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor;
}

/**
 * Unified decorator that works on both classes and methods.
 * Automatically logs method success and errors.
 * Optionally logs method invocation when configured.
 *
 * **Usage on Classes:**
 * When applied to a class, wraps all methods in the class with logging.
 * A `logger` property is auto-injected if not already defined.
 *
 * **Usage on Methods:**
 * When applied to a method, wraps only that specific method with logging.
 *
 * This decorator logs:
 * - Method invocation with all arguments (only when `onInvoke: true`)
 * - Successful completion with arguments
 * - Errors with arguments and error details (Axios errors are automatically prettified)
 *
 * **Log Format:**
 * All logs are output as structured objects with the following format:
 * - Invocation: `{ method: string, state: 'invoked', args: Record<string, any> }` (only when `onInvoke: true`)
 * - Success: `{ method: string, state: 'success', args: Record<string, any> }`
 * - Error: `{ method: string, state: 'error', args: Record<string, any>, error: Error | PrettifiedAxiosError }`
 *
 * **Custom Argument Formatting:**
 * Use the `args` option to customize how arguments are logged. This is useful for:
 * - Excluding large objects from logs
 * - Logging only specific arguments
 * - Transforming sensitive data before logging
 *
 * **Error Handling:**
 * - Axios errors are automatically prettified using `prettifyAxiosError` to provide structured error information
 * - Regular errors are logged as-is
 * - Both types preserve the original error for re-throwing
 *
 * **Supported Methods:**
 * - Synchronous methods
 * - Asynchronous methods (returns Promise)
 * - Methods with any number of arguments
 * - Methods with no arguments
 *
 * @example
 * // Class-level usage - logs all methods, logger auto-injected
 * @Log()
 * class UserService {
 *   createUser(name: string, email: string) {
 *     return { id: 1, name, email }
 *   }
 *
 *   deleteUser(id: number) {
 *     // delete logic
 *   }
 * }
 *
 * @example
 * // Method-level usage - logs only specific method
 * class DataService {
 *   @Log({ onInvoke: true })
 *   async fetchData(id: number) {
 *     const data = await this.repository.findById(id)
 *     return data
 *   }
 *
 *   // This method is not logged
 *   helperMethod() {
 *     return 'helper'
 *   }
 * }
 *
 * @example
 * // Error handling with regular errors
 * class PaymentService {
 *   @Log()
 *   processPayment(amount: number, currency: string) {
 *     if (amount <= 0) {
 *       throw new Error('Invalid amount')
 *     }
 *     return { status: 'success' }
 *   }
 * }
 *
 * // When error occurs:
 * // [PaymentService] { method: 'processPayment', state: 'error', args: { amount: -10, currency: 'USD' }, error: Error(...) }
 *
 * @example
 * // Error handling with Axios errors (automatically prettified)
 * class ApiService {
 *   @Log()
 *   async fetchData(url: string) {
 *     const response = await this.httpClient.get(url)
 *     return response.data
 *   }
 * }
 *
 * // When Axios error occurs:
 * // [ApiService] {
 * //   method: 'fetchData',
 * //   state: 'error',
 * //   args: { url: 'http://api.example.com/data' },
 * //   error: {
 * //     name: 'AxiosError',
 * //     error: 'Request failed with status code 404',
 * //     code: 'ERR_BAD_REQUEST',
 * //     config: { method: 'get', url: 'http://api.example.com/data', ... },
 * //     response: { status: 404, statusText: 'Not Found', data: ..., headers: ... }
 * //   }
 * // }
 *
 * @example
 * // Custom argument formatting - exclude large objects from logs
 * class SyncService {
 *   @Log({ args: (loanId: number) => ({ loanId }) })
 *   async syncLoan(loanId: number, loanData?: unknown) {
 *     // loanData is excluded from logs due to large size
 *     // Only loanId will be logged
 *     return this.processLoan(loanId, loanData)
 *   }
 *
 *   @Log({ args: (loanId: number, transactionId: number) => ({ loanId, transactionId }) })
 *   async syncPayment(loanId: number, transactionId: number, loanData?: unknown) {
 *     // Only loanId and transactionId are logged, loanData is excluded
 *     return this.processPayment(loanId, transactionId, loanData)
 *   }
 * }
 *
 * // Logs output:
 * // [SyncService] { method: 'syncLoan', state: 'success', args: { loanId: 123 } }
 * // [SyncService] { method: 'syncPayment', state: 'success', args: { loanId: 123, transactionId: 456 } }
 *
 * @param options - Configuration options for the decorator
 * @returns Decorator function that can be applied to classes or methods
 */
export const Log = <TArgs extends unknown[]>(options: LogOptions<TArgs> = {}): LogDecorator => {
  const { onInvoke: shouldLogInvoke = false, args: formatArgs } = options;

  // Cast to LogDecorator to enable overloaded signatures
  return ((
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: (new (...args: any[]) => unknown) | object,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any => {
    // Class decorator receives 1 argument (constructor)
    if (propertyKey === undefined) {
      // Build hooks for class-level decoration
      const className = (target as { name: string }).name ?? '';

      // Create a map to store parameter names for each method (extracted at decoration time)
      const paramNamesMap = new Map<string, string[]>();

      // Pre-extract parameter names from all methods on the prototype
      const prototype = (target as { prototype: Record<string, unknown> }).prototype;
      const propertyNames = Object.getOwnPropertyNames(prototype);

      for (const propertyName of propertyNames) {
        if (propertyName === 'constructor') continue;

        const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
        if (!descriptor || typeof descriptor.value !== 'function') continue;

        // Store parameter names for this method
        paramNamesMap.set(propertyName, getParameterNames(descriptor.value as (...args: unknown[]) => unknown));
      }

      const hooks: EffectHooks<unknown> = {
        onInvoke: shouldLogInvoke
          ? (args, instance, methodName) => {
              const methodKey = String(methodName);
              const parameterNames = paramNamesMap.get(methodKey) ?? [];
              const argsObject = formatArgs
                ? formatArgs(...(args as TArgs))
                : buildArgsObject(parameterNames, args);
              const logWrapper = createLogWrapper(instance, className, methodKey, argsObject);
              logWrapper.invoked();
            }
          : undefined,

        afterReturn: (args, instance, methodName, result) => {
          const methodKey = String(methodName);
          const parameterNames = paramNamesMap.get(methodKey) ?? [];
          const argsObject = formatArgs
            ? formatArgs(...(args as TArgs))
            : buildArgsObject(parameterNames, args);
          const logWrapper = createLogWrapper(instance, className, methodKey, argsObject);
          logWrapper.success();
          // Return the original result
          return result;
        },

        onError: (args, instance, methodName, error) => {
          const methodKey = String(methodName);
          const parameterNames = paramNamesMap.get(methodKey) ?? [];
          const argsObject = formatArgs
            ? formatArgs(...(args as TArgs))
            : buildArgsObject(parameterNames, args);
          const logWrapper = createLogWrapper(instance, className, methodKey, argsObject);
          logWrapper.error(error);
          // Re-throw the error
          throw error;
        },
      };

      // Apply Effect with exclusion key for NoLog support
      Effect(hooks, NO_LOG_METADATA_KEY)(target as new (...args: unknown[]) => unknown);

      // Inject logger getter/setter on prototype if missing
      injectLoggerIfMissing(target as Function);

      return target;
    }

    // Method decorator receives 3 arguments (target, propertyKey, descriptor)
    if (descriptor !== undefined) {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
      const parameterNames = getParameterNames(originalMethod);
      const methodName = String(propertyKey);

      // Build hooks for method-level decoration
      const hooks: EffectHooks<unknown> = {
        onInvoke: shouldLogInvoke
          ? (args, instance) => {
              const argsObject = formatArgs
                ? formatArgs(...(args as TArgs))
                : buildArgsObject(parameterNames, args);
              const className = (instance.constructor as { name: string }).name ?? '';
              const logWrapper = createLogWrapper(instance, className, methodName, argsObject);
              logWrapper.invoked();
            }
          : undefined,

        afterReturn: (args, instance, _methodName, result) => {
          const argsObject = formatArgs
            ? formatArgs(...(args as TArgs))
            : buildArgsObject(parameterNames, args);
          const className = (instance.constructor as { name: string }).name ?? '';
          const logWrapper = createLogWrapper(instance, className, methodName, argsObject);
          logWrapper.success();
          // Return the original result
          return result;
        },

        onError: (args, instance, _methodName, error) => {
          const argsObject = formatArgs
            ? formatArgs(...(args as TArgs))
            : buildArgsObject(parameterNames, args);
          const className = (instance.constructor as { name: string }).name ?? '';
          const logWrapper = createLogWrapper(instance, className, methodName, argsObject);
          logWrapper.error(error);
          // Re-throw the error
          throw error;
        },
      };

      // Use EffectOnMethod directly for method-level (no exclusion key needed)
      return EffectOnMethod(hooks)(target, propertyKey, descriptor);
    }

    throw new Error('Log decorator can only be applied to classes or methods');
  }) as LogDecorator;
};

/**
 * Method decorator that prevents logging when used with class-level @Log()
 *
 * Use this decorator to exclude specific methods from being logged when
 * the entire class is decorated with @Log().
 *
 * **Note:** This decorator has no effect when used without a class-level @Log() decorator.
 *
 * @example
 * @Log()
 * class UserService {
 *   createUser(name: string) {
 *     // This will be logged
 *     return { name }
 *   }
 *
 *   @NoLog()
 *   internalHelper() {
 *     // This will NOT be logged
 *     return 'helper'
 *   }
 * }
 *
 * @example
 * // With multiple @NoLog() methods
 * @Log()
 * class DataService {
 *   fetchData(id: number) {
 *     // Logged
 *     return this.privateCalculation(id)
 *   }
 *
 *   @NoLog()
 *   privateCalculation(id: number) {
 *     // Not logged
 *     return id * 2
 *   }
 *
 *   @NoLog()
 *   anotherHelper() {
 *     // Not logged
 *     return 'helper'
 *   }
 * }
 *
 * @returns {MethodDecorator} The method decorator function
 */
export const NoLog = (): MethodDecorator => SetMeta(NO_LOG_METADATA_KEY, true);
