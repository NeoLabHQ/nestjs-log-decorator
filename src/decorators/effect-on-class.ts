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
import type { HooksOrFactory } from './hook.types';
import { EffectOnMethod, EFFECT_APPLIED_KEY } from './effect-on-method';

/**
 * Class decorator factory that wraps every eligible prototype method with
 * lifecycle hooks via {@link EffectOnMethod}.
 *
 * Skipped members:
 * - `constructor`
 * - Non-function prototype values
 * - Getters and setters (only plain `descriptor.value` functions are wrapped)
 * - Methods marked with `exclusionKey` metadata (double-wrap prevention and
 *   explicit exclusion via e.g. `@NoLog()`)
 *
 * @typeParam R - The return type expected from lifecycle hooks
 * @param hooks        - Lifecycle callbacks forwarded to {@link EffectOnMethod}
 * @param exclusionKey - Symbol used to detect already-decorated and excluded
 *                       methods. Defaults to {@link EFFECT_APPLIED_KEY}. Pass a
 *                       custom symbol to isolate this decorator from other
 *                       Effect-based decorators.
 * @returns A standard `ClassDecorator`
 *
 * @example
 * ```ts
 * const SKIP = Symbol('skip');
 *
 * \@EffectOnClass({ onReturn: ({ propertyKey, result }) => { console.log(propertyKey); return result; } }, SKIP)
 * class Service {
 *   doWork() { return 42; }
 *
 *   \@SetMeta(SKIP, true)
 *   internal() { return 'skipped'; }
 * }
 * ```
 */
export const EffectOnClass = <R = unknown>(
  hooks: HooksOrFactory<R>,
  exclusionKey: symbol = EFFECT_APPLIED_KEY,
): ClassDecorator => {
  const methodDecorator = EffectOnMethod(hooks, exclusionKey);

  return (target: Function): void => {
    const prototype = target.prototype as Record<string, unknown>;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') {
        continue
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (
        !descriptor
        || !isPlainMethod(descriptor) 
        || shouldSkipMethod(descriptor, exclusionKey)
      ) {
        continue;
      }

      methodDecorator(prototype as object, propertyName, descriptor);
      Object.defineProperty(prototype, propertyName, descriptor);
    }
  };
};


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
 * Uses the provided `exclusionKey` to check for metadata on the method.
 * When `EffectOnMethod` wraps a method it marks it with the same key,
 * so this single check handles both double-wrap prevention (method already
 * decorated by this decorator type) and explicit exclusion (e.g. `@NoLog()`).
 */
const shouldSkipMethod = (
  descriptor: PropertyDescriptor,
  exclusionKey: symbol,
): boolean => {
  return getMeta(exclusionKey, descriptor) === true;
};
