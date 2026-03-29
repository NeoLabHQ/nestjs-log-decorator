/**
 * Lifecycle hook decorator that fires a callback when the method throws.
 *
 * Delegates to {@link Effect} with only the `onError` hook set. Works on
 * both classes (wrapping every eligible prototype method) and individual
 * methods, inheriting all class/method dispatch logic from `Effect`.
 *
 * The callback receives the raw arguments array, the `this` target object,
 * the property key, the thrown error, and the property descriptor. It may
 * return a recovery value or re-throw the error.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module on-error.hook
 */

import { Effect } from './effect.decorator';
import type { OnErrorHookType } from './set-meta.decorator';

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
 *   \@OnErrorHook((args, target, key, error) => {
 *     console.error(key, 'failed:', error);
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
