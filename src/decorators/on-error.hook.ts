import { Effect } from './effect.decorator';
import type { OnErrorHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` when the decorated method
 * throws an error. The callback may return a recovery value or re-throw
 * the error to propagate it.
 *
 * @typeParam R - The return type of the decorated method
 * @param callback - Function called when the method throws
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@OnErrorHook(({ propertyKey, error }) => {
 *     console.error(propertyKey, 'failed:', error);
 *     throw error; // re-throw after logging
 *   })
 *   riskyOperation() { throw new Error('oops'); }
 * }
 * ```
 */
export const OnErrorHook = <R = unknown>(
  callback: OnErrorHookType<R>,
): ClassDecorator & MethodDecorator => {
  return Effect<R>({ onError: callback });
};
