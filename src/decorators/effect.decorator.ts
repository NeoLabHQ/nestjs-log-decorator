/**
 * Unified decorator factory that works on both classes and methods.
 *
 * Detects whether it is applied to a class constructor (1 argument) or
 * a method descriptor (3 arguments) and delegates to {@link EffectOnClass}
 * or {@link EffectOnMethod} accordingly. This mirrors the dispatch pattern
 * used by the `Log` decorator.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module effect.decorator
 */

import { EffectOnMethod } from './effect-on-method';
import { EffectOnClass } from './effect-on-class';
import type { EffectHooks } from './set-meta.decorator';

/**
 * Creates a decorator that can be applied to either a class or a method.
 *
 * When applied to a **class** (receives 1 argument -- the constructor),
 * delegates to {@link EffectOnClass} which wraps every eligible prototype
 * method with the provided lifecycle hooks, skipping methods already
 * marked with `EFFECT_APPLIED_KEY` or `exclusionKey`.
 *
 * When applied to a **method** (receives 3 arguments -- target, propertyKey,
 * descriptor), delegates to {@link EffectOnMethod} which wraps that single
 * method with the provided lifecycle hooks and marks it with
 * `EFFECT_APPLIED_KEY` to prevent double-wrapping by a class-level decorator.
 *
 * Throws an `Error` if invoked in any other context (e.g. `propertyKey` is
 * present but `descriptor` is `undefined`).
 *
 * @typeParam R - The return type expected from lifecycle hooks
 * @param hooks        - Lifecycle callbacks forwarded to the underlying decorator
 * @param exclusionKey - Optional symbol; passed to {@link EffectOnClass} so
 *                       methods carrying this metadata are skipped during
 *                       class-level decoration. Ignored for method-level usage.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * // Method-level usage
 * class Service {
 *   \@Effect({ afterReturn: (args, t, k, r) => { console.log(k); return r; } })
 *   doWork() { return 42; }
 * }
 *
 * // Class-level usage
 * \@Effect({ onInvoke: (args, t, k) => console.log('called', k) })
 * class AnotherService {
 *   methodA() { return 'a'; }
 *   methodB() { return 'b'; }
 * }
 * ```
 */
export const Effect = <R = unknown>(
  hooks: EffectHooks<R>,
  exclusionKey?: symbol,
): ClassDecorator & MethodDecorator => {
  const classDecorator = EffectOnClass<R>(hooks, exclusionKey);
  const methodDecorator = EffectOnMethod<R>(hooks);

  return ((
    target: Function | object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): Function | PropertyDescriptor | void => {
    // Class decorator: receives 1 argument (the constructor)
    if (propertyKey === undefined) {
      classDecorator(target as Function);
      return target as Function;
    }

    // Method decorator: receives 3 arguments (target, propertyKey, descriptor)
    if (descriptor !== undefined) {
      return methodDecorator(target, propertyKey, descriptor);
    }

    throw new Error('Effect decorator can only be applied to classes or methods');
  }) as ClassDecorator & MethodDecorator;
};
