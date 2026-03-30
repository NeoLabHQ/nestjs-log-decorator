import { EffectOnMethod } from './effect-on-method';
import { EffectOnClass } from './effect-on-class';
import type { HooksOrFactory } from './hook.types';

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
 * method with the provided lifecycle hooks and marks it with `exclusionKey`
 * (or `EFFECT_APPLIED_KEY` if none provided) to prevent double-wrapping
 * by a class-level decorator.
 *
 * Throws an `Error` if invoked in any other context (e.g. `propertyKey` is
 * present but `descriptor` is `undefined`).
 *
 * @typeParam R - The return type expected from lifecycle hooks
 * @param hooks        - Lifecycle callbacks forwarded to the underlying decorator
 * @param exclusionKey - Optional symbol; passed to both {@link EffectOnClass}
 *                       and {@link EffectOnMethod}. Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `EFFECT_APPLIED_KEY`.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * // Method-level usage
 * class Service {
 *   \@Effect({ onReturn: ({ propertyKey, result }) => { console.log(propertyKey); return result; } })
 *   doWork() { return 42; }
 * }
 *
 * // Class-level usage
 * \@Effect({ onInvoke: ({ propertyKey }) => console.log('called', propertyKey) })
 * class AnotherService {
 *   methodA() { return 'a'; }
 *   methodB() { return 'b'; }
 * }
 * ```
 */
export const Effect = <R = unknown>(
  hooks: HooksOrFactory<R>,
  exclusionKey?: symbol,
): ClassDecorator & MethodDecorator => {
  const classDecorator = EffectOnClass<R>(hooks, exclusionKey);
  const methodDecorator = EffectOnMethod<R>(hooks, exclusionKey);

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
