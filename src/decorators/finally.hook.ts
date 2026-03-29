/**
 * Lifecycle hook decorator that fires a callback after method execution
 * regardless of whether it succeeded or threw.
 *
 * Delegates to {@link Effect} with only the `finally` hook set. Works on
 * both classes (wrapping every eligible prototype method) and individual
 * methods, inheriting all class/method dispatch logic from `Effect`.
 *
 * The callback receives the raw arguments array, the `this` target object,
 * the property key, and the property descriptor.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module finally.hook
 */

import { Effect } from './effect.decorator';
import type { FinallyHookType } from './set-meta.decorator';

/**
 * Creates a decorator that invokes `callback` after every method execution,
 * regardless of outcome. Useful for cleanup, resource release, or metrics
 * finalization that must run whether the method succeeded or failed.
 *
 * @param callback - Function called after every method execution
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@FinallyHook((args, target, key) => console.log(key, 'completed'))
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const FinallyHook = (
  callback: FinallyHookType,
): ClassDecorator & MethodDecorator => {
  return Effect({ finally: callback });
};
