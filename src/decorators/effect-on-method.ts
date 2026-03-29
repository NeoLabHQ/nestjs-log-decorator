/**
 * Generic method decorator that wraps a method with lifecycle hooks.
 *
 * Provides four optional hooks -- `onInvoke`, `afterReturn`, `onError`,
 * and `finally` -- that fire at well-defined points during method execution.
 * Works transparently with both synchronous and asynchronous methods.
 *
 * This module is logger-agnostic and contains zero imports from `@nestjs/common`.
 *
 * @module effect-on-method
 */

import { setMeta } from './set-meta.decorator';
import type { EffectHooks } from './set-meta.decorator';

export type { EffectHooks };

/** Internal key for the `_symMeta` Map stored on function objects. */
const SYM_META_PROP = '_symMeta';

/**
 * Symbol sentinel set on every function wrapped by {@link EffectOnMethod}.
 *
 * Used by `EffectOnClass` to detect methods that have already been wrapped
 * at the method level, preventing double-wrapping when both class-level
 * and method-level decorators are applied.
 */
export const EFFECT_APPLIED_KEY: unique symbol = Symbol('effectApplied');

/**
 * Copies the `_symMeta` Map from the original function to a new function.
 *
 * When `EffectOnMethod` replaces `descriptor.value` with a wrapper,
 * any metadata previously set on the original function (e.g. via `@SetMeta`
 * or `@NoLog`) must survive on the new wrapper so downstream consumers
 * (like `EffectOnClass`) can still read it.
 */
const copySymMeta = (
  source: Function,
  target: Function,
): void => {
  const sourceRecord = source as unknown as Record<string, unknown>;
  const sourceMap = sourceRecord[SYM_META_PROP] as
    | Map<symbol, unknown>
    | undefined;

  if (!sourceMap || sourceMap.size === 0) return;

  const targetRecord = target as unknown as Record<string, unknown>;

  if (!targetRecord[SYM_META_PROP]) {
    Object.defineProperty(target, SYM_META_PROP, {
      value: new Map<symbol, unknown>(),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  const targetMap = targetRecord[SYM_META_PROP] as Map<symbol, unknown>;
  sourceMap.forEach((value, key) => {
    targetMap.set(key, value);
  });
};

/**
 * Handles the synchronous success + finally path.
 *
 * Separated to keep the main decorator body within line limits.
 */
const handleSyncSuccess = <R>(
  result: R,
  args: unknown[],
  context: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  hooks: EffectHooks<R>,
): R => {
  try {
    return hooks.afterReturn
      ? hooks.afterReturn(args, context, propertyKey, result, descriptor)
      : result;
  } finally {
    if (hooks.finally) {
      hooks.finally(args, context, propertyKey, descriptor);
    }
  }
};

/**
 * Handles the synchronous error + finally path.
 *
 * Separated to keep the main decorator body within line limits.
 */
const handleSyncError = <R>(
  error: unknown,
  args: unknown[],
  context: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  hooks: EffectHooks<R>,
): R => {
  try {
    if (hooks.onError) {
      return hooks.onError(args, context, propertyKey, error, descriptor);
    }

    throw error;
  } finally {
    if (hooks.finally) {
      hooks.finally(args, context, propertyKey, descriptor);
    }
  }
};

/**
 * Chains promise lifecycle hooks for asynchronous method execution.
 *
 * Uses `.then` / `.catch` / `.finally` on the returned promise so that
 * `afterReturn` fires after resolution, `onError` fires after rejection,
 * and `finally` always fires last.
 */
const chainAsyncHooks = <R>(
  promise: Promise<R>,
  args: unknown[],
  context: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  hooks: EffectHooks<R>,
): Promise<R> => {
  let chained = promise.then((value) => {
    if (hooks.afterReturn) {
      return hooks.afterReturn(args, context, propertyKey, value, descriptor);
    }
    return value;
  });

  chained = chained.catch((error: unknown) => {
    if (hooks.onError) {
      return hooks.onError(args, context, propertyKey, error, descriptor);
    }
    throw error;
  });

  if (hooks.finally) {
    chained = chained.finally(() => {
      hooks.finally!(args, context, propertyKey, descriptor);
    });
  }

  return chained;
};

/**
 * Method decorator factory that wraps `descriptor.value` with lifecycle hooks.
 *
 * The wrapped function preserves `this` context and transparently handles
 * both sync and async (Promise-returning) methods. After wrapping, the
 * {@link EFFECT_APPLIED_KEY} sentinel is set on the new function via
 * `setMeta`, and any existing `_symMeta` metadata from the original
 * function is copied to the wrapper.
 *
 * @typeParam R - The return type of the decorated method
 * @param hooks - Lifecycle callbacks (all optional)
 * @returns A standard `MethodDecorator`
 *
 * @example
 * ```ts
 * class Service {
 *   \@EffectOnMethod({
 *     onInvoke: (args, target, key) => console.log('called', key),
 *     afterReturn: (args, target, key, result) => { console.log('done'); return result; },
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const EffectOnMethod = <R = unknown>(
  hooks: EffectHooks<R>,
): MethodDecorator => {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    const wrapped = function (this: object, ...args: unknown[]): unknown {
      if (hooks.onInvoke) {
        hooks.onInvoke(args, this, propertyKey, descriptor);
      }

      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return chainAsyncHooks(
            result as Promise<R>,
            args,
            this,
            propertyKey,
            descriptor,
            hooks,
          );
        }

        return handleSyncSuccess(
          result as R,
          args,
          this,
          propertyKey,
          descriptor,
          hooks,
        );
      } catch (error: unknown) {
        return handleSyncError(error, args, this, propertyKey, descriptor, hooks);
      }
    };

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;

    setMeta(EFFECT_APPLIED_KEY, true, descriptor);

    return descriptor;
  };
};
