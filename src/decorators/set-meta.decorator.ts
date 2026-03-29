/**
 * Symbol-keyed metadata storage primitives for decorator infrastructure.
 *
 * Stores metadata as a Map on function objects under a non-enumerable
 * `_symMeta` property. This approach avoids `reflect-metadata` dependency
 * and allows multiple metadata keys to coexist on the same function.
 *
 * @module set-meta.decorator
 */

/**
 * Hook fired before the original method executes.
 * @typeParam R - The return type of the decorated method (unused, for consistency)
 */
export type OnInvokeHookType<R = unknown> = (
  args: unknown[],
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => void;

/**
 * Hook fired after a successful return. Its return value replaces the method result.
 * @typeParam R - The return type of the decorated method
 */
export type AfterReturnHookType<R = unknown> = (
  args: unknown[],
  target: object,
  propertyKey: string | symbol,
  result: R,
  descriptor: PropertyDescriptor,
) => R;

/**
 * Hook fired when the method throws. May return a recovery value or re-throw.
 * @typeParam R - The return type of the decorated method
 */
export type OnErrorHookType<R = unknown> = (
  args: unknown[],
  target: object,
  propertyKey: string | symbol,
  error: unknown,
  descriptor: PropertyDescriptor,
) => R;

/**
 * Hook fired after both success and error paths, regardless of outcome.
 * @typeParam R - The return type of the decorated method (unused, for consistency)
 */
export type FinallyHookType<R = unknown> = (
  args: unknown[],
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => void;

/**
 * Lifecycle hooks for method decoration via Effect-based decorators.
 *
 * Each hook receives the raw arguments array, the `this` target object,
 * the property key, and the property descriptor. Hooks are optional --
 * omitting a hook simply skips that lifecycle point.
 *
 * @typeParam R - The return type of the decorated method
 */
export interface EffectHooks<R = unknown> {
  /** Fires before the original method executes. */
  onInvoke?: OnInvokeHookType<R>;

  /** Fires after a successful return. Its return value replaces the method result. */
  afterReturn?: AfterReturnHookType<R>;

  /** Fires when the method throws. May return a recovery value or re-throw. */
  onError?: OnErrorHookType<R>;

  /** Fires after both success and error paths, regardless of outcome. */
  finally?: FinallyHookType<R>;
}

/** Internal key used to store the metadata Map on function objects. */
const SYM_META_PROP = '_symMeta';

/**
 * Stores a symbol-keyed metadata value on the function referenced by
 * `descriptor.value`. Creates a non-enumerable `_symMeta` Map on the
 * function if one does not already exist.
 *
 * @param key   - Symbol identifying the metadata entry
 * @param value - Arbitrary value to store
 * @param descriptor - Property descriptor whose `value` holds the target function
 *
 * @example
 * ```ts
 * const MY_KEY = Symbol('myKey');
 * setMeta(MY_KEY, true, descriptor);
 * ```
 */
export const setMeta = (
  key: symbol,
  value: unknown,
  descriptor: PropertyDescriptor,
): void => {
  const fn = descriptor.value as Record<string, unknown> & {
    [SYM_META_PROP]?: Map<symbol, unknown>;
  };

  if (!fn[SYM_META_PROP]) {
    Object.defineProperty(fn, SYM_META_PROP, {
      value: new Map<symbol, unknown>(),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  fn[SYM_META_PROP]!.set(key, value);
};

/**
 * Retrieves a symbol-keyed metadata value previously stored via {@link setMeta}.
 *
 * Returns `undefined` when:
 * - `descriptor` is `undefined` or `null`
 * - `descriptor.value` is `undefined` or `null`
 * - No `_symMeta` Map exists on the function
 * - The specified `key` has not been set
 *
 * @typeParam T - Expected type of the stored value
 * @param key        - Symbol identifying the metadata entry
 * @param descriptor - Property descriptor whose `value` holds the target function
 * @returns The stored value cast to `T`, or `undefined` if not found
 *
 * @example
 * ```ts
 * const MY_KEY = Symbol('myKey');
 * const value = getMeta<boolean>(MY_KEY, descriptor);
 * ```
 */
export const getMeta = <T = unknown>(
  key: symbol,
  descriptor: PropertyDescriptor | undefined,
): T | undefined => {
  const fn = descriptor?.value as
    | (Record<string, unknown> & { [SYM_META_PROP]?: Map<symbol, unknown> })
    | undefined
    | null;

  return fn?.[SYM_META_PROP]?.get(key) as T | undefined;
};

/**
 * Decorator factory that sets symbol-keyed metadata on the decorated
 * method's `descriptor.value` at decoration time.
 *
 * This is the decorator form of {@link setMeta} -- it returns a
 * `MethodDecorator` so it can be applied with `@SetMeta(key, value)`.
 *
 * @param key   - Symbol identifying the metadata entry
 * @param value - Arbitrary value to store
 * @returns A MethodDecorator that calls {@link setMeta} on the target method
 *
 * @example
 * ```ts
 * const SKIP_KEY = Symbol('skip');
 *
 * class Service {
 *   \@SetMeta(SKIP_KEY, true)
 *   helperMethod() { return 'helper'; }
 * }
 * ```
 */
export const SetMeta = (key: symbol, value: unknown): MethodDecorator => {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    setMeta(key, value, descriptor);
    return descriptor;
  };
};
