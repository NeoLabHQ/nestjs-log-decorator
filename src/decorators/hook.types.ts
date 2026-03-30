/** Pre-built args object mapping parameter names to their values. */
export type HookArgs = Record<string, unknown> | undefined;

/**
 * Shared context passed to every lifecycle hook.
 *
 * Contains the common fields available at every lifecycle point:
 * the pre-built args object, the `this` target, the property key,
 * the property descriptor, extracted parameter names, and the
 * runtime class name.
 */
export interface HookContext {
  /** Pre-built args object mapping parameter names to their values. */
  argsObject: HookArgs;
  /** Raw arguments array passed to the method. */
  args: unknown[];
  /** The `this` target object (class instance). */
  target: object;
  /** The property key of the decorated method. */
  propertyKey: string | symbol;
  /** The property descriptor of the decorated method. */
  descriptor: PropertyDescriptor;
  /** Parameter names extracted from the original function signature. */
  parameterNames: string[];
  /** Runtime class name derived from `this.constructor.name`. */
  className: string;
}

/** Context for the onReturn hook, adding the method result. */
export interface OnReturnContext<R = unknown> extends HookContext {
  /** The value returned by the original method. */
  result: R;
}

/** Context for the onError hook, adding the thrown error. */
export interface OnErrorContext extends HookContext {
  /** The error thrown by the original method. */
  error: unknown;
}

/**
 * Hook fired before the original method executes.
 * @typeParam R - The return type of the decorated method (unused, for consistency)
 */
export type OnInvokeHookType<R = unknown> = (
  context: HookContext,
) => void;

/**
 * Hook fired after a successful return. Its return value replaces the method result.
 * @typeParam R - The return type of the decorated method
 */
export type OnReturnHookType<R = unknown> = (
  context: OnReturnContext<R>,
) => R;

/**
 * Hook fired when the method throws. May return a recovery value or re-throw.
 * @typeParam R - The return type of the decorated method
 */
export type OnErrorHookType<R = unknown> = (
  context: OnErrorContext,
) => R;

/**
 * Hook fired after both success and error paths, regardless of outcome.
 * @typeParam R - The return type of the decorated method (unused, for consistency)
 */
export type FinallyHookType<R = unknown> = (
  context: HookContext,
) => void;

/**
 * Lifecycle hooks for method decoration via Effect-based decorators.
 *
 * Each hook receives a context object containing the pre-built args,
 * `this` target, property key, descriptor, parameter names, and class
 * name. Hooks are optional -- omitting a hook simply skips that
 * lifecycle point.
 *
 * @typeParam R - The return type of the decorated method
 */
export interface EffectHooks<R = unknown> {
  /** Fires before the original method executes. */
  onInvoke?: OnInvokeHookType<R>;

  /** Fires after a successful return. Its return value replaces the method result. */
  onReturn?: OnReturnHookType<R>;

  /** Fires when the method throws. May return a recovery value or re-throw. */
  onError?: OnErrorHookType<R>;

  /** Fires after both success and error paths, regardless of outcome. */
  finally?: FinallyHookType<R>;
}

/**
 * Accepts either a static hooks object or a factory function that
 * produces hooks at runtime from the invocation context.
 *
 * When a factory is provided, it is called once per method invocation
 * inside the wrapper function, before any hooks fire.
 *
 * @typeParam R - The return type of the decorated method
 */
export type HooksOrFactory<R = unknown> =
  | EffectHooks<R>
  | ((context: HookContext) => EffectHooks<R>);
