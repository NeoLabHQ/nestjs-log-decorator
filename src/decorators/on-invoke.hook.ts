/**
 * Lifecycle hook decorator that fires a callback before method execution.
 *
 * Delegates to {@link Effect} with only the `onInvoke` hook set. Works on
 * both classes (wrapping every eligible prototype method) and individual
 * methods, inheriting all class/method dispatch logic from `Effect`.
 *
 * The callback receives the raw arguments array, the `this` target object,
 * the property key, and the property descriptor -- identical to the
 * `onInvoke` hook in {@link EffectHooks}.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module on-invoke.hook
 */

import { Effect } from './effect.decorator';
import type { OnInvokeHookType } from './set-meta.decorator';

/**
 * Creates a decorator that invokes `callback` before the decorated method
 * executes. Useful for pre-execution side effects such as tracing, metrics,
 * or input validation logging.
 *
 * @param callback - Function called before each method invocation
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@OnInvokeHook((args, target, key) => console.log('calling', key))
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const OnInvokeHook = (
  callback: OnInvokeHookType,
): ClassDecorator & MethodDecorator => {
  return Effect({ onInvoke: callback });
};
