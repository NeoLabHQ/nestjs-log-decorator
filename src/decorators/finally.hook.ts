import { Effect } from './effect.decorator';
import type { FinallyHookType } from './hook.types';

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
 *   \@FinallyHook(({ propertyKey, args }) => console.log(propertyKey, 'completed', args))
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const FinallyHook = (
  callback: FinallyHookType,
): ClassDecorator & MethodDecorator => {
  return Effect({ finally: callback });
};
