import { Effect, SetMeta } from './decorators';
import { createLogWrapper } from './LogWrapper';
import { type LogOptions, NO_LOG_METADATA_KEY } from './types';

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
 * - Success: `{ method: string, state: 'success', args: Record<string, any>, result?: unknown }`
 * - Error: `{ method: string, state: 'error', args: Record<string, any>, error: Error | PrettifiedAxiosError }`
 *
 * **Custom Argument Formatting:**
 * Use the `args` option to customize how arguments are logged. This is useful for:
 * - Excluding large objects from logs
 * - Logging only specific arguments
 * - Transforming sensitive data before logging
 *
 * **Result Logging:**
 * Use the `result` option to include successful return values in success logs.
 * - `result: true` logs the raw returned value
 * - `result: (value) => ...` logs a formatted value
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
 * // Custom argument formatting - exclude large objects from logs
 * class SyncService {
 *   @Log({ args: (loanId: number) => ({ loanId }) })
 *   async syncLoan(loanId: number, loanData?: unknown) {
 *     return this.processLoan(loanId, loanData)
 *   }
 * }
 *
 * @param options - Configuration options for the decorator
 * @returns Decorator function that can be applied to classes or methods
 */
export const Log = <TArgs extends unknown[], TResult = unknown>({
  onInvoke: shouldLogInvoke = false,
  args: formatArgs,
  result: formatResult,
}: LogOptions<TArgs, TResult> = {}): LogDecorator => 
  Effect<unknown>(
    ({ args, argsObject, target, propertyKey, className }) => {
      const formattedArgs = formatArgs ? formatArgs(...(args as TArgs)) : argsObject;
      const resultFormatter = typeof formatResult === 'function' ? formatResult : (value: TResult): TResult => value;
      
      const logger = createLogWrapper(target, className, String(propertyKey), formattedArgs);
      
      return {
        onInvoke: shouldLogInvoke ? () => logger.invoked() : undefined,
        onReturn: ({ result }) => {
          logger.success(undefined, formatResult ? { result: resultFormatter(result as TResult) } : undefined);
          return result;
        },
        onError: ({ error }) => { logger.error(error); throw error; },
      };
    },
    NO_LOG_METADATA_KEY,
  ) as LogDecorator;

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
 * @returns {MethodDecorator} The method decorator function
 */
export const NoLog = (): MethodDecorator => SetMeta(NO_LOG_METADATA_KEY, true);
