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

export * from './set-meta.decorator';
export type * from './hook.types';
export * from './effect-on-method';
export * from './effect-on-class';
export * from './effect.decorator';

// Hook decorator functions (values)
export * from './on-invoke.hook';
export * from './on-return.hook';
export * from './on-error.hook';
export * from './finally.hook';
