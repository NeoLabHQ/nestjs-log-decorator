export type {
  HookArgs,
  OnInvokeHookType,
  OnReturnHookType,
  OnErrorHookType,
  FinallyHookType,
  EffectHooks,
} from './hook.types';

/** Internal key used to store the metadata Map on function objects. */
export const SYM_META_PROP = '_symMeta';

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
