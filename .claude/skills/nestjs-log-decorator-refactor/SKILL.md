---
name: NestJS Log Decorator Refactor
description: Covers the refactor of nestjs-log-decorator to introduce generic Effect/EffectOnMethod/EffectOnClass/SetMeta decorator infrastructure, auto-inject NestJS Logger, and prevent double-logging
topics: nestjs, typescript, decorators, logging, refactor, effect-decorator, metadata, auto-injection
created: 2026-03-28
updated: 2026-03-28
scratchpad: .specs/scratchpad/b59b2655.md
---

# NestJS Log Decorator Refactor

## Overview

This skill covers refactoring the `nestjs-log-decorator` library to introduce a generic, logger-agnostic `src/decorators/` layer (`EffectOnMethod`, `EffectOnClass`, `Effect`, `SetMeta`, hook decorators) that `Log` and `NoLog` are rebuilt on top of. The refactor also removes the requirement for users to define a `logger` property on their class by auto-injecting a NestJS `Logger` instance at decoration time, and fixes the double-logging bug when both class-level and method-level `@Log()` are applied.

---

## Key Concepts

- **EffectOnMethod**: Generic method decorator factory that wraps a method with lifecycle hooks (`onInvoke`, `afterReturn`, `onError`, `finally`) and marks it with an `EFFECT_APPLIED_KEY` sentinel.
- **EffectOnClass**: Generic class decorator factory that iterates prototype methods, skips those marked with `EFFECT_APPLIED_KEY` or `NO_LOG_KEY`, and applies `EffectOnMethod` to the rest.
- **Effect**: Unified factory (like `Log`) that detects class vs method by argument count and delegates to `EffectOnClass` or `EffectOnMethod`.
- **SetMeta / getMeta / setMeta**: Symbol-keyed metadata stored as a `Map` on the function object (`fn._symMeta`). No `Reflect.metadata` required.
- **Auto-Logger Injection**: Prototype getter/setter pattern that injects `new Logger(this.constructor.name)` lazily if no `logger` is already defined on the prototype.
- **Double-Wrap Prevention**: `EffectOnClass` checks `getMeta(EFFECT_APPLIED_KEY, descriptor)` before wrapping; if true (set by a prior method-level `Effect`/`Log`), the method is skipped.

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| NestJS Logger docs | Logger instantiation, context param | https://docs.nestjs.com/techniques/logger |
| @nestjs/common Logger type defs | Constructor overloads, LoggerService interface | node_modules/@nestjs/common/services/logger.service.d.ts |
| TypeScript decorator proposal | Decorator evaluation order (method before class) | https://www.typescriptlang.org/docs/handbook/decorators.html |
| Current source | Existing log.decorator.ts, applyToMethod.ts, applyToClass.ts, LogWrapper.ts | src/ directory |
| Task spec | Full requirements for refactor, fix, and feature | .specs/tasks/draft/remove-logger-requirement.refactor.md |

---

## Recommended Libraries & Tools

| Name | Purpose | Maturity | Notes |
|------|---------|----------|-------|
| @nestjs/common Logger | Auto-inject when no user logger present | Stable | `new Logger(className)` — importable from peer dep |
| vitest | Testing framework already in use | Stable | v4.0.16 in devDependencies |
| tsdown | Build system (CJS output) | Stable | Config unchanged |

### Recommended Stack

Use `@nestjs/common Logger` (already a peer dependency) for auto-injection. No new dependencies needed.

---

## Patterns & Best Practices

### Pattern 1: Auto-Logger Injection via Prototype Getter/Setter

**When to use**: In the class-level `Log` decorator path, after `EffectOnClass` completes.

**Trade-offs**: Getter/setter ensures user-defined `readonly logger = new Logger(...)` class fields still work (TypeScript transpiles them as constructor assignments that trigger the setter, which stores the value as an own property on the instance, taking precedence over the getter).

**Example**:
```typescript
const AUTO_LOGGER_SYM = Symbol('autoLogger');

function injectLoggerIfMissing(target: Function): void {
  if ('logger' in target.prototype) return; // user already has logger

  Object.defineProperty(target.prototype, 'logger', {
    get() {
      if (!this[AUTO_LOGGER_SYM]) {
        this[AUTO_LOGGER_SYM] = new Logger(this.constructor.name);
      }
      return this[AUTO_LOGGER_SYM];
    },
    set(value: unknown) {
      // Allow instance-level assignment (e.g., readonly logger = new Logger(...) in constructor)
      Object.defineProperty(this, 'logger', {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
    enumerable: true,
    configurable: true,
  });
}
```

### Pattern 2: Double-Wrap Prevention via EFFECT_APPLIED Sentinel

**When to use**: In `EffectOnClass`, before deciding to wrap each prototype method.

**Trade-offs**: Requires `EffectOnMethod` to call `setMeta(EFFECT_APPLIED_KEY, true, descriptor)` on the wrapped function. Simple and zero-overhead.

**Example**:
```typescript
const EFFECT_APPLIED_KEY = Symbol('effectApplied');

// In EffectOnMethod - after creating the wrapped function:
setMeta(EFFECT_APPLIED_KEY, true, descriptor);

// In EffectOnClass - before wrapping each method:
if (getMeta(EFFECT_APPLIED_KEY, descriptor)) return; // skip - already wrapped
if (getMeta(NO_LOG_KEY, descriptor)) return;         // skip - @NoLog()
```

### Pattern 3: Symbol-Keyed Metadata on Function Objects

**When to use**: For any metadata that needs to be stored on/associated with a decorated method.

**Trade-offs**: No `reflect-metadata` required. Metadata travels with the function when reassigned (as long as the Map reference is copied). Must copy metadata map when wrapping functions.

**Example**:
```typescript
function setMeta(sym: symbol, value: unknown, descriptor: PropertyDescriptor): void {
  const fn = descriptor.value as Record<symbol, unknown> & { _symMeta?: Map<symbol, unknown> };
  if (!fn._symMeta) {
    Object.defineProperty(fn, '_symMeta', { value: new Map<symbol, unknown>(), writable: false });
  }
  fn._symMeta!.set(sym, value);
}

function getMeta<T = unknown>(sym: symbol, descriptor: PropertyDescriptor | undefined): T | undefined {
  return (descriptor?.value as any)?._symMeta?.get(sym) as T | undefined;
}
```

When `EffectOnMethod` creates a wrapped function, copy existing metadata from original:
```typescript
// After defining wrapped function:
const originalMeta = (originalFn as any)._symMeta as Map<symbol, unknown> | undefined;
if (originalMeta) {
  originalMeta.forEach((v, k) => { /* copy to wrapped fn's _symMeta */ });
}
```

### Pattern 4: EffectOnMethod Hook Interface

**When to use**: Any decorator that needs lifecycle hooks on a method.

**Trade-offs**: `afterReturn` and `onError` return `R` to allow result transformation. `finally` runs regardless. Hooks receive raw `args` array (not a formatted object) for maximum generality.

**Example**:
```typescript
interface EffectHooks<R = unknown> {
  onInvoke?: (args: unknown[], target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void;
  afterReturn?: (args: unknown[], target: object, propertyKey: string | symbol, result: R, descriptor: PropertyDescriptor) => R;
  onError?: (args: unknown[], target: object, propertyKey: string | symbol, error: unknown, descriptor: PropertyDescriptor) => R;
  finally?: (args: unknown[], target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void;
}
```

For async methods, handle the full lifecycle in Promise chains:
```typescript
// In EffectOnMethod wrapped function body (async path):
return result
  .then((value) => {
    if (hooks.afterReturn) return hooks.afterReturn(args, this, key, value, descriptor);
    return value;
  })
  .catch((error) => {
    if (hooks.onError) return hooks.onError(args, this, key, error, descriptor);
    throw error;
  })
  .finally(() => {
    if (hooks.finally) hooks.finally(args, this, key, descriptor);
  });
```

### Pattern 5: Decorator File Structure (src/decorators/)

```
src/decorators/
  set-meta.decorator.ts     # setMeta, getMeta, SetMeta decorator
  effect-on-method.ts       # effectOnMethod, EffectOnMethod decorator, EFFECT_APPLIED_KEY
  effect-on-class.ts        # effectOnClass, EffectOnClass decorator
  effect.decorator.ts       # Effect decorator (class + method unified)
  on-invoke.hook.ts         # OnInvokeHook decorator
  after-return.hook.ts      # AfterReturnHook decorator
  on-error.hook.ts          # OnErrorHook decorator
  finally.hook.ts           # FinallyHook decorator
  index.ts                  # Re-exports
```

All files in `src/decorators/` must be logger-agnostic. No imports from `@nestjs/common`.

---

## Similar Implementations

### EffectOnMethod Pattern Origin
- **Source**: Common in AOP (Aspect-Oriented Programming) libraries
- **Approach**: Wrap method with lifecycle hooks, use Symbol-keyed sentinel to prevent double-wrapping
- **Applicability**: Directly applicable

### NestJS Auto-Logger Injection
- **Source**: NestJS internal ConsoleLogger uses `setContext()` on existing logger; similar lazy-init pattern
- **Approach**: Prototype getter with instance-level setter fallback
- **Applicability**: Directly applicable - NestJS Logger constructor accepts context string

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| User has `readonly logger` as class field - setter throws | High | Define setter that uses `Object.defineProperty(this, ...)` to create own property |
| Double-logging when class + method @Log() both applied | High | EFFECT_APPLIED_KEY sentinel in EffectOnClass check |
| Metadata lost when EffectOnMethod wraps a function | Medium | Copy `_symMeta` Map from original to wrapped function |
| `finally` hook not called on async errors | Medium | Use `.finally()` on Promise chain, not try/finally for async path |
| `this.constructor.name` minified in production builds | Low | tsdown outputs CJS, class names preserved; document as known limitation if minification used |
| Removing applyToMethod/applyToClass exports is breaking | Medium | Task explicitly accepts; update CHANGELOG and major version |
| LoggableConstructor type removed - TypeScript users get less type safety | Low | Remove type constraint per task spec; Log() accepts any class now |

---

## Recommendations

1. **Keep LogWrapper for formatting**: `LogWrapper` in `src/LogWrapper.ts` handles Axios prettification and log format; retain it but remove the `createLogWrapper` throw requirement. The `afterReturn`/`onError` hooks in `Log` will create `LogWrapper` from the current instance's logger.
2. **`isLoggable` remains useful as a utility**: Keep `isLoggable` exported but it becomes optional - the logger is now always present due to auto-injection.
3. **Method-level Log overrides class-level**: Decorator order guarantees method-level `@Log()` runs first (sets EFFECT_APPLIED_KEY), so class-level `@Log()` on the same class will skip that method. This is the correct semantics.
4. **Export Effect, SetMeta, getMeta from index**: Expose the new generic decorator layer so it can be reused by consumers.
5. **Do not export EffectOnMethod/EffectOnClass as top-level unless needed**: The `Effect` unified decorator is sufficient for public API; internals can stay internal.

---

## Implementation Guidance

### Installation (no change)

```bash
npm install nestjs-log-decorator @nestjs/common
# @nestjs/common v11.x confirmed compatible
```

### Configuration (no change)

`tsconfig.json` requires:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Integration Points

1. **New directory**: Create `src/decorators/` with all generic decorator files
2. **Modify** `src/log.decorator.ts`: Import `Effect` from `src/decorators/`; add `injectLoggerIfMissing` call in class path; remove `LoggableConstructor` type constraint
3. **Modify** `src/LogWrapper.ts`: Remove `createLogWrapper` throw; expose helper to get-or-create logger
4. **Modify** `src/index.ts`: Remove `applyToMethod`, `applyToClass` exports; add new decorator exports
5. **Update** tests: Remove test for "should throw error if logger property is not found"; add tests for auto-injection and double-logging prevention

---

## Code Examples

### Example 1: Log Rebuilt Using Effect

```typescript
import { Logger } from '@nestjs/common';
import { Effect } from './decorators/effect.decorator';
import { LogWrapper } from './LogWrapper';

export const Log = <TArgs extends unknown[]>(options: LogOptions<TArgs> = {}) => {
  return Effect({
    onInvoke: options.onInvoke ? (args, target, key) => {
      const argsObj = resolveArgs(args, options, /* paramNames */);
      getLogger(target).log({ method: key, state: 'invoked', args: argsObj });
    } : undefined,
    afterReturn: (args, target, key, result) => {
      const argsObj = resolveArgs(args, options, /* paramNames */);
      getLogger(target).log({ method: key, state: 'success', args: argsObj });
      return result;
    },
    onError: (args, target, key, error) => {
      const argsObj = resolveArgs(args, options, /* paramNames */);
      getLogger(target).error({ method: key, state: 'error', args: argsObj, error: prettifyAxiosError(error) });
      throw error;
    },
  });
};

function getLogger(target: object): Logger {
  return (target as any).logger as Logger;
}
```

### Example 2: NoLog Rebuilt Using SetMeta

```typescript
import { SetMeta } from './decorators/set-meta.decorator';
import { NO_LOG_KEY } from './decorators/effect-on-class';

export const NoLog = () => SetMeta(NO_LOG_KEY, true);
```

### Example 3: Auto-Logger Injection in Log Class Path

```typescript
const AUTO_LOGGER_SYM = Symbol('autoLogger');

function injectLoggerIfMissing(target: Function): void {
  if ('logger' in target.prototype) return;

  Object.defineProperty(target.prototype, 'logger', {
    get(this: object) {
      const self = this as Record<symbol, Logger>;
      if (!self[AUTO_LOGGER_SYM]) {
        self[AUTO_LOGGER_SYM] = new Logger((this.constructor as Function).name);
      }
      return self[AUTO_LOGGER_SYM];
    },
    set(this: object, value: unknown) {
      Object.defineProperty(this, 'logger', { value, writable: true, enumerable: true, configurable: true });
    },
    enumerable: true,
    configurable: true,
  });
}
```

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| node_modules/@nestjs/common/services/logger.service.d.ts (v11.1.12) | Official | 2026-03-28 |
| TypeScript Decorators Handbook | Official | 2026-03-28 |
| Node.js runtime tests (inline) | Runtime verification | 2026-03-28 |
| src/ directory (current codebase) | Codebase | 2026-03-28 |
| .specs/tasks/draft/remove-logger-requirement.refactor.md | Task spec | 2026-03-28 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-03-28 | Initial creation for task: Remove requirement to define logger property on class to use decorator |
