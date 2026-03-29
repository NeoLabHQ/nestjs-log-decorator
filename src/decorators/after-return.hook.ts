/**
 * Lifecycle hook decorator that fires a callback after successful method return.
 *
 * Delegates to {@link Effect} with only the `afterReturn` hook set. Works on
 * both classes (wrapping every eligible prototype method) and individual
 * methods, inheriting all class/method dispatch logic from `Effect`.
 *
 * The callback receives the raw arguments array, the `this` target object,
 * the property key, the return value, and the property descriptor. Its return
 * value replaces the original method result.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module after-return.hook
 */

import { Effect } from './effect.decorator';
import type { AfterReturnHookType } from './set-meta.decorator';

/**
 * Creates a decorator that invokes `callback` after the decorated method
 * returns successfully. The callback's return value replaces the method
 * result, enabling post-processing or result transformation.
 *
 * @typeParam R - The return type of the decorated method
 * @param callback - Function called after successful return
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@AfterReturnHook((args, target, key, result) => {
 *     console.log(key, 'returned', result);
 *     return result;
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const AfterReturnHook = <R = unknown>(
  callback: AfterReturnHookType<R>,
): ClassDecorator & MethodDecorator => {
  return Effect<R>({ afterReturn: callback });
};
