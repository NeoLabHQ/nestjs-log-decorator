export * from './log.decorator';
export * from './types';
export * from './LogWrapper';
export * from './axios/axios.logger';
export * from './axios/isTimoutError';

// Generic decorator primitives (logger-agnostic)
export {
  Effect,
  EffectOnMethod,
  EffectOnClass,
  SetMeta,
  getMeta,
  setMeta,
  EFFECT_APPLIED_KEY,
  OnInvokeHook,
  AfterReturnHook,
  OnErrorHook,
  FinallyHook,
} from './decorators';

export type {
  EffectHooks,
  OnInvokeHookType,
  AfterReturnHookType,
  OnErrorHookType,
  FinallyHookType,
} from './decorators';
