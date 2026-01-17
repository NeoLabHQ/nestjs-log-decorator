import { applyToClass } from './decorate/applyToClass';
import { applyToMethod } from './decorate/applyToMethod';
import { type LogOptions, NO_LOG_METADATA_KEY } from './types';
import type { Loggable } from './LogWrapper';

interface LoggableConstructor {
  new (...args: unknown[]): Loggable;
}

/**
 * Decorator function that can be applied to classes or methods.
 * Uses overloads to provide type checking for class decorators while
 * keeping method decorators flexible.
 */
interface LogDecorator {
  /** Class decorator - enforces that class instances have a `logger` property */
  <T extends LoggableConstructor>(target: T): T;
  /** Method decorator - no compile-time constraint on `this` */
  (target: object, propertyKey?: unknown, descriptor?: unknown): PropertyDescriptor;
}

/**
 * Unified decorator that works on both classes and methods.
 * Automatically logs method success and errors.
 * Optionally logs method invocation when configured.
 *
 * **Usage on Classes:**
 * When applied to a class, wraps all methods in the class with logging.
 *
 * **Usage on Methods:**
 * When applied to a method, wraps only that specific method with logging.
 *
 * This decorator logs:
 * - Method invocation with all arguments (only when `onInvoke: true`)
 * - Successful completion with arguments
 * - Errors with arguments and error details (Axios errors are automatically prettified)
 *
 * **Requirements:**
 * The class must have a `logger` property (typically a NestJS Logger instance).
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
 * // Class-level usage - logs all methods
 * @Log()
 * class UserService {
 *   readonly logger = new Logger(UserService.name)
 *
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
 *   readonly logger = new Logger(DataService.name)
 *
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
 *   readonly logger = new Logger(PaymentService.name)
 *
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
 *   readonly logger = new Logger(ApiService.name)
 *
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
 *   readonly logger = new Logger(SyncService.name)
 *
 *   @Log({ args: (loanId: number) => ({ loanId }) })
 *   async syncLoan(loanId: number, loanData?: CloudbankinLoan) {
 *     // loanData is excluded from logs due to large size
 *     // Only loanId will be logged
 *     return this.processLoan(loanId, loanData)
 *   }
 *
 *   @Log({ args: (loanId: number, transactionId: number) => ({ loanId, transactionId }) })
 *   async syncPayment(loanId: number, transactionId: number, loanData?: CloudbankinLoan) {
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
 * @throws {Error} If the logger property is not found in the class instance
 *
 * @returns Decorator function that can be applied to classes or methods
 */
export const Log = <TArgs extends unknown[]>(options: LogOptions<TArgs> = {}): LogDecorator => {
  // Cast to LogDecorator to enable overloaded signatures
  return ((
    target: LoggableConstructor | object,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ): LoggableConstructor | PropertyDescriptor | void => {
    // Class decorator receives 1 argument (constructor)
    if (propertyKey === undefined) {
      applyToClass(target as LoggableConstructor, options as LogOptions);
      return target as LoggableConstructor;
    }

    // Method decorator receives 3 arguments (target, propertyKey, descriptor)
    if (descriptor !== undefined) {
      return applyToMethod(target, propertyKey, descriptor, options as LogOptions);
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
 *   readonly logger = new Logger(UserService.name)
 *
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
 *   readonly logger = new Logger(DataService.name)
 *
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
export const NoLog = () => {
  return (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    // Mark this method as "no log" using a symbol
    const value = descriptor.value as Record<string, unknown>;
    value[NO_LOG_METADATA_KEY as unknown as string] = true;
    return descriptor;
  };
};
