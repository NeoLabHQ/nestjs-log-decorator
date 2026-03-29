/**
 * Barrel re-export for all generic, logger-agnostic decorator primitives.
 *
 * This module exposes the full decorator infrastructure: metadata storage
 * (`SetMeta`, `getMeta`, `setMeta`), method/class lifecycle wrappers
 * (`EffectOnMethod`, `EffectOnClass`, `Effect`), the double-wrap prevention
 * sentinel (`EFFECT_APPLIED_KEY`), the hook type interface (`EffectHooks`),
 * and four convenience lifecycle hook decorators.
 *
 * All exports in this module are logger-agnostic and contain zero imports
 * from `@nestjs/common`.
 *
 * @module decorators
 */

export { SetMeta, getMeta, setMeta } from './set-meta.decorator';
export type {
  EffectHooks,
  OnInvokeHookType,
  AfterReturnHookType,
  OnErrorHookType,
  FinallyHookType,
} from './set-meta.decorator';
export { EffectOnMethod, EFFECT_APPLIED_KEY } from './effect-on-method';
export { EffectOnClass } from './effect-on-class';
export { Effect } from './effect.decorator';

// Hook decorator functions (values)
export { OnInvokeHook } from './on-invoke.hook';
export { AfterReturnHook } from './after-return.hook';
export { OnErrorHook } from './on-error.hook';
export { FinallyHook } from './finally.hook';
