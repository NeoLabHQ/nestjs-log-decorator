import type { OnErrorContext } from 'base-decorators'
import type { LogArgsFormatter } from 'nestjs-log-decorator'
import { OnErrorHook } from 'base-decorators'
import { createLogWrapper } from 'nestjs-log-decorator'

/**
 * Type for error class constructors that can be used with the Catch decorator.
 * Matches any class that extends Error and has a constructor.
 */
interface ErrorClassConstructor<T extends Error = Error> {
  new (...args: never[]): T
}

/**
 * Predicate function that determines whether a caught error should be handled.
 * Return true to catch the error, false to re-throw it.
 */
type ErrorPredicate = (error: unknown) => boolean

/**
 * Configuration for the Catch method decorator.
 *
 * @typeParam T - The error instance type. Inferred from `on` when an error class is provided.
 * @typeParam R - The return type of the handle callback.
 * @typeParam V - The method arguments tuple type for `formatArgs`.
 * @param on - Error class, predicate function, or undefined.
 *             When an error class is provided, only instances of that class are caught.
 *             When a predicate function is provided, the error is caught if the predicate returns true.
 *             When omitted, all errors are caught.
 * @param handle - Callback invoked with the caught error and original method arguments.
 *                 Bound to the class instance so `this` refers to the service.
 * @param formatArgs - Optional function to format method arguments for logging.
 * @param message - Optional custom error message for logging.
 */
type CatchConfig<T extends Error = Error, R = void, V extends unknown[] = unknown[]>
  = | { on: ErrorClassConstructor<T>, handle: (error: T, methodArgs: V) => R, formatArgs?: LogArgsFormatter<V>, message?: string }
    | { on: ErrorPredicate, handle: (error: unknown, methodArgs: V) => R, formatArgs?: LogArgsFormatter<V>, message?: string }
    | { on?: undefined, handle: (error: unknown, methodArgs: V) => R, formatArgs?: LogArgsFormatter<V>, message?: string }

/** Unique exclusion key for Catch decorators, isolating them from other Effect-based decorators. */
const CATCH_EXCLUSION_KEY: unique symbol = Symbol('catch')

/**
 * Method decorator that wraps an async method in a try-catch block.
 *
 * When `on` is an error class, only instances of that class are caught;
 * all other errors are re-thrown. When `on` is a predicate function,
 * the error is caught if the predicate returns true.
 * When `on` is omitted, all errors are caught.
 *
 * The `handle` callback is invoked with `this` bound to the class instance,
 * receiving the caught error and the original method arguments.
 *
 * Multiple `@Catch` decorators can be stacked on a single method. Decorators
 * are applied bottom-up: the innermost (lowest) decorator catches first,
 * and unmatched errors propagate to the next outer decorator.
 *
 * @param config - Catch configuration specifying the error type filter and handler
 * @returns A method decorator that wraps the target method in error handling
 *
 * @example
 * ```ts
 * // Catch a specific error type
 * Catch({ on: AxiosError, handle(error) { this.logger.error(error.message) } })
 * async fetchData(): Promise<Data> { ... }
 *
 * // Catch with a predicate function
 * Catch({ on: (e) => e instanceof AxiosError && e.status === 404, handle(error) { ... } })
 * async fetchData(): Promise<Data> { ... }
 * ```
 */
function Catch<T extends Error = Error, R = void, V extends unknown[] = unknown[]>(config: CatchConfig<T, R, V>): MethodDecorator {
  return OnErrorHook(({ error, target, className, propertyKey, args, argsObject }: OnErrorContext) => {
    if (!shouldCatchError(config.on, error))
      throw error

    const logArgs = config.formatArgs ? config.formatArgs(...args as V) : argsObject
    const logger = createLogWrapper(target, className, propertyKey as string, logArgs)

    logger.error(error, config.message)
    const handle = config.handle as (error: unknown, methodArgs: unknown[]) => R

    return handle.call(target, error, args) as never
  }, CATCH_EXCLUSION_KEY)
}

export { Catch }
export type { CatchConfig, ErrorClassConstructor, ErrorPredicate }

/**
 * Determines whether the caught error matches the configured filter.
 * When no filter is configured (catch-all), all errors match.
 * When an error class is configured, only instances of that class match.
 * When a predicate is configured, the error matches if the predicate returns true.
 *
 * @param on - The error filter (class constructor, predicate, or undefined for catch-all)
 * @param error - The caught error to check
 * @returns True if the error should be handled, false if it should be re-thrown
 */
function shouldCatchError(on: ErrorClassConstructor | ErrorPredicate | undefined, error: unknown): boolean {
  if (!on)
    return true

  if (isErrorConstructor(on))
    return isInstanceOf(on, error)

  return on(error)
}

/**
 * Checks whether `on` is an error class constructor (has a prototype chain from Error).
 *
 * @param on - The value to check (error class constructor or predicate function)
 * @returns True if `on` is an error class constructor
 */
function isErrorConstructor(on: ErrorClassConstructor | ErrorPredicate): on is ErrorClassConstructor {
  return on.prototype instanceof Error || on === Error
}

/**
 * Type guard that checks whether a caught value is an instance of the given error class.
 *
 * @param errorType - Error class constructor to check against
 * @param error - The caught value to check
 * @returns True if the error is an instance of errorType
 */
function isInstanceOf<T extends Error>(errorType: ErrorClassConstructor<T>, error: unknown): error is T {
  return error instanceof errorType
}
