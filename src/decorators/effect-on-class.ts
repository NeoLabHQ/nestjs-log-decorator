/**
 * Class-level decorator that applies lifecycle hooks to all prototype methods.
 *
 * Iterates `Object.getOwnPropertyNames(target.prototype)`, skipping the
 * constructor, non-function values, getters/setters, methods already wrapped
 * by {@link EffectOnMethod} (detected via {@link EFFECT_APPLIED_KEY}), and
 * methods excluded via an optional `exclusionKey` symbol.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module effect-on-class
 */

import { getMeta } from './set-meta.decorator';
import type { EffectHooks } from './set-meta.decorator';
import { EffectOnMethod, EFFECT_APPLIED_KEY } from './effect-on-method';

/**
 * Determines whether a property descriptor represents a plain method.
 *
 * Returns `false` for getters, setters, and non-function values so that
 * only callable `descriptor.value` entries are considered for wrapping.
 */
const isPlainMethod = (descriptor: PropertyDescriptor): boolean => {
  if (descriptor.get || descriptor.set) return false;
  return typeof descriptor.value === 'function';
};

/**
 * Determines whether a method should be skipped by the class decorator.
 *
 * Checks are ordered intentionally: {@link EFFECT_APPLIED_KEY} is evaluated
 * **before** `exclusionKey` so that a method-level `@EffectOnMethod` (or
 * `@Log()`) always wins over a `@NoLog()`-style exclusion applied to the
 * same method within a class-level decorator.
 */
const shouldSkipMethod = (
  descriptor: PropertyDescriptor,
  exclusionKey: symbol | undefined,
): boolean => {
  if (getMeta(EFFECT_APPLIED_KEY, descriptor)) return true;
  if (exclusionKey && getMeta(exclusionKey, descriptor)) return true;
  return false;
};

/**
 * Class decorator factory that wraps every eligible prototype method with
 * lifecycle hooks via {@link EffectOnMethod}.
 *
 * Skipped members:
 * - `constructor`
 * - Non-function prototype values
 * - Getters and setters (only plain `descriptor.value` functions are wrapped)
 * - Methods already marked with {@link EFFECT_APPLIED_KEY} (double-wrap prevention)
 * - Methods marked with `exclusionKey` metadata (e.g. `@NoLog()`)
 *
 * @typeParam R - The return type expected from lifecycle hooks
 * @param hooks        - Lifecycle callbacks forwarded to {@link EffectOnMethod}
 * @param exclusionKey - Optional symbol; methods carrying this metadata are skipped
 * @returns A standard `ClassDecorator`
 *
 * @example
 * ```ts
 * const SKIP = Symbol('skip');
 *
 * \@EffectOnClass({ afterReturn: (args, t, k, r) => { console.log(k); return r; } }, SKIP)
 * class Service {
 *   doWork() { return 42; }
 *
 *   \@SetMeta(SKIP, true)
 *   internal() { return 'skipped'; }
 * }
 * ```
 */
export const EffectOnClass = <R = unknown>(
  hooks: EffectHooks<R>,
  exclusionKey?: symbol,
): ClassDecorator => {
  const methodDecorator = EffectOnMethod(hooks);

  return (target: Function): void => {
    const prototype = target.prototype as Record<string, unknown>;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (!descriptor) continue;

      if (!isPlainMethod(descriptor)) continue;
      if (shouldSkipMethod(descriptor, exclusionKey)) continue;

      methodDecorator(prototype as object, propertyName, descriptor);
      Object.defineProperty(prototype, propertyName, descriptor);
    }
  };
};
