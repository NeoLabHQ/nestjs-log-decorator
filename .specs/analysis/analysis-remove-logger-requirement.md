---
title: Codebase Impact Analysis - Remove requirement to define logger property on class to use decorator
task_file: .specs/tasks/draft/remove-logger-requirement.refactor.md
scratchpad: .specs/scratchpad/b8540e56.md
created: 2026-03-28
status: complete
---

# Codebase Impact Analysis: Remove Logger Requirement

## Summary

- **Files to Modify**: 5 files (`log.decorator.ts`, `LogWrapper.ts`, `index.ts`, `tests/log.decorator.spec.ts`, `README.md`)
- **Files to Create**: 16 files (8 source files in `src/decorators/` + 8 test files in `tests/decorators/`)
- **Files to Delete**: 2 files (`src/decorate/applyToMethod.ts`, `src/decorate/applyToClass.ts`)
- **Test Files Affected**: 1 existing + 8 new test files
- **Risk Level**: High (breaking public API changes; fundamental re-architecture of core decorator composition)

---

## Files to be Modified/Created

### Primary Changes

```
src/
├── decorators/                         # NEW folder: logger-agnostic decorator primitives
│   ├── EffectOnMethod.ts               # NEW: generic method lifecycle-hook decorator; absorbs applyToMethod + getParameterNames + handleAsyncExecution logic; defines EFFECT_ON_METHOD_KEY symbol
│   ├── EffectOnClass.ts                # NEW: generic class decorator; absorbs applyToClass logic; checks EFFECT_ON_METHOD_KEY and NO_LOG_METADATA_KEY to skip already-decorated methods
│   ├── Effect.ts                       # NEW: unified class+method decorator; moves Log composition logic; argument-count detection delegates to EffectOnMethod or EffectOnClass
│   ├── SetMeta.ts                      # NEW: setMeta(symbol, value, fn), getMeta(symbol, fn) helpers + SetMeta(symbol, value) decorator factory; used by NoLog rebuild
│   ├── OnInvokeHook.ts                 # NEW: thin wrapper over Effect({onInvoke: ...}); for future use
│   ├── AfterReturnHook.ts              # NEW: thin wrapper over Effect({afterReturn: ...}); for future use
│   ├── OnErrorHook.ts                  # NEW: thin wrapper over Effect({onError: ...}); for future use
│   └── FinallyHook.ts                  # NEW: thin wrapper over Effect({finally: ...}); for future use
├── log.decorator.ts                    # UPDATE: rebuild Log using Effect; rebuild NoLog using SetMeta; remove LoggableConstructor type; add logger auto-injection at class decoration time and method call time
├── LogWrapper.ts                       # UPDATE: change createLogWrapper to auto-inject Logger instead of throwing; update Loggable/isLoggable jsdoc; keep buildArgsObject and LogWrapper class unchanged
├── index.ts                            # UPDATE: remove exports for ./decorate/applyToMethod and ./decorate/applyToClass; add exports for ./decorators/EffectOnMethod, ./decorators/EffectOnClass, ./decorators/Effect, ./decorators/SetMeta, ./decorators/OnInvokeHook, ./decorators/AfterReturnHook, ./decorators/OnErrorHook, ./decorators/FinallyHook
└── decorate/
    ├── applyToMethod.ts                # DELETE: logic moved to src/decorators/EffectOnMethod.ts
    └── applyToClass.ts                 # DELETE: logic moved to src/decorators/EffectOnClass.ts
```

### Test Changes

```
tests/
├── log.decorator.spec.ts               # UPDATE: remove "should throw error if logger property is not found" test (line 333); add auto-injection tests; add double-logging prevention assertion; update mixed-decorator test to assert exact call counts
└── decorators/                         # NEW folder for new decorator unit tests
    ├── EffectOnMethod.spec.ts          # NEW: test lifecycle hooks, param extraction, async handling, EFFECT_ON_METHOD_KEY marking
    ├── EffectOnClass.spec.ts           # NEW: test class method iteration, NoLog skip, already-decorated skip
    ├── Effect.spec.ts                  # NEW: test class+method double-logging prevention via class+method Effect on same method
    ├── SetMeta.spec.ts                 # NEW: test setMeta/getMeta/SetMeta decorator
    ├── OnInvokeHook.spec.ts            # NEW: test thin wrapper behavior
    ├── AfterReturnHook.spec.ts         # NEW: test thin wrapper behavior
    ├── OnErrorHook.spec.ts             # NEW: test thin wrapper behavior
    └── FinallyHook.spec.ts             # NEW: test thin wrapper behavior
```

### Documentation Updates

```
README.md                               # UPDATE: remove "class must have a public `logger` property" requirement; update Quick Start example to not require logger; update all examples in Usage, Advanced Example sections
```

---

## Useful Resources for Implementation

### Pattern References

```
src/
├── decorate/
│   ├── applyToMethod.ts               # Source for EffectOnMethod logic (getParameterNames, handleAsyncExecution, wrapper function body)
│   └── applyToClass.ts                # Source for EffectOnClass logic (prototype iteration, descriptor rewrite)
└── log.decorator.ts                   # Source for LoggableConstructor removal and Effect composition pattern
```

The `@NoLog()` implementation in `src/log.decorator.ts:239-246` is the direct pattern reference for `SetMeta` — it already sets a Symbol on `descriptor.value`.

---

## Key Interfaces & Contracts

### Functions/Methods to Modify

| Location | Name | Current Signature | Change Required |
|----------|------|-------------------|-----------------|
| `src/LogWrapper.ts:71` | `createLogWrapper` | `(instance, className, methodName, argsObject) => LogWrapper` — throws if no logger | Change to auto-inject `new Logger(className)` on `instance` if not loggable; never throw |
| `src/log.decorator.ts:166` | `Log` (inner fn) | `(target: LoggableConstructor | object, ...)` | Remove `LoggableConstructor` constraint; use `new (...args: any[]) => any` or `Function`; rebuild body using `Effect` |
| `src/log.decorator.ts:239` | `NoLog` | Sets Symbol on `descriptor.value` directly | Rebuild using `SetMeta(NO_LOG_METADATA_KEY, true)` from `SetMeta.ts` |

### Classes/Components Affected

| Location | Name | Description | Change Required |
|----------|------|-------------|-----------------|
| `src/LogWrapper.ts:9` | `LogWrapper` | Formats and outputs log entries via NestJS Logger | No change to class methods; only `createLogWrapper` factory changes |
| `src/LogWrapper.ts:59` | `Loggable` | Interface: `{ logger: Logger }` | Keep interface; update JSDoc to note it is no longer required (auto-injected) |
| `src/log.decorator.ts:14` | `LogDecorator` | Interface with class + method overloads | Class overload: change `<T extends LoggableConstructor>` to `<T extends new (...args: any[]) => any>` |

### Types/Interfaces to Update

| Location | Name | Fields Affected | Change Required |
|----------|------|-----------------|-----------------|
| `src/log.decorator.ts:7` | `LoggableConstructor` | Entire type | Remove; replace with generic constructor type or inline |
| `src/types.ts:36` | `NO_LOG_METADATA_KEY` | Symbol value | Stays in `types.ts`; also imported by new `SetMeta.ts` when NoLog rebuilds; OR move to `src/decorators/SetMeta.ts` if cleaner |

### New Interfaces to Create

| Location | Name | Description |
|----------|------|-------------|
| `src/decorators/EffectOnMethod.ts` | `EffectOptions<R>` | `{ onInvoke?, afterReturn?, onError?, finally? }` lifecycle hooks |
| `src/decorators/EffectOnMethod.ts` | `EFFECT_ON_METHOD_KEY` | `Symbol('effectOnMethod')` — marks already-method-decorated functions |

### New Public Export Signatures

The following concrete TypeScript signatures must be implemented and exported from `src/index.ts`:

```typescript
// src/decorators/SetMeta.ts

/** Store arbitrary metadata on a function object under a symbol key. */
function setMeta<T>(key: symbol, value: T, fn: Function): void;

/** Retrieve metadata previously stored with setMeta. Returns undefined if not set. */
function getMeta<T>(key: symbol, fn: Function): T | undefined;

/** Decorator factory: sets metadata key=value on descriptor.value at decoration time. */
function SetMeta<T>(key: symbol, value: T): MethodDecorator;

// src/decorators/Effect.ts

/** Lifecycle hooks passed to Effect/EffectOnMethod/EffectOnClass. */
interface EffectOptions<TArgs extends unknown[] = unknown[]> {
  onInvoke?: (methodName: string, args: TArgs) => void;
  afterReturn?: (methodName: string, args: TArgs, result: unknown) => void;
  onError?: (methodName: string, args: TArgs, error: unknown) => void;
  finally?: (methodName: string, args: TArgs) => void;
}

/**
 * Unified class+method decorator.
 * When called with zero arguments (i.e. `@Effect(options)`) returns a decorator
 * that dispatches to EffectOnMethod when applied to a method descriptor, or to
 * EffectOnClass when applied to a constructor.
 */
function Effect<TArgs extends unknown[] = unknown[]>(
  options: EffectOptions<TArgs>,
): ClassDecorator & MethodDecorator;

// src/decorators/EffectOnMethod.ts

/**
 * Method decorator that wraps descriptor.value with lifecycle hooks.
 * Sets EFFECT_ON_METHOD_KEY on the wrapped function so EffectOnClass can
 * detect and skip it.
 */
function EffectOnMethod<TArgs extends unknown[] = unknown[]>(
  options: EffectOptions<TArgs>,
): MethodDecorator;

// src/decorators/EffectOnClass.ts

/**
 * Class decorator that applies EffectOnMethod to every prototype method,
 * skipping the constructor, methods marked with NO_LOG_METADATA_KEY, and
 * methods already marked with EFFECT_ON_METHOD_KEY.
 */
function EffectOnClass<TArgs extends unknown[] = unknown[]>(
  options: EffectOptions<TArgs>,
): ClassDecorator;
```

---

## Integration Points

| File | Relationship | Impact | Action Needed |
|------|--------------|--------|---------------|
| `src/index.ts` | Barrel export of entire public API | High | Remove `./decorate/applyToMethod` and `./decorate/applyToClass`; add `./decorators/*` exports |
| `src/log.decorator.ts` | Imports `applyToClass`, `applyToMethod`, `Loggable` | High | Replace imports with `Effect` from `src/decorators/Effect.ts` and `SetMeta` from `src/decorators/SetMeta.ts` |
| `src/LogWrapper.ts` | Imports `Logger` from `@nestjs/common` | High | `createLogWrapper` must auto-inject using `new Logger(className)` |
| `src/decorate/applyToClass.ts` | Imports `applyToMethod` | N/A | File deleted |
| `tests/log.decorator.spec.ts` | Imports `Log`, `NoLog` from `src/log.decorator` | High | Update for auto-injection feature; add double-log prevention tests |
| `src/types.ts` | Defines `NO_LOG_METADATA_KEY` symbol and `LogOptions` interface; both `applyToClass.ts` and `log.decorator.ts` import from here | Medium | `NO_LOG_METADATA_KEY` may stay in `types.ts` or move to `src/decorators/SetMeta.ts` depending on final layering decision. If moved, `src/log.decorator.ts` import path changes and `src/types.ts` must re-export it to avoid breaking consumers who import it directly. The `LogOptions` interface stays in `types.ts` unchanged. |

---

## Similar Implementations

### Pattern 1: NoLog Symbol Metadata (existing)

- **Location**: `src/log.decorator.ts:239-246`
- **Why relevant**: The `@NoLog()` decorator sets `descriptor.value[NO_LOG_METADATA_KEY] = true` directly on the function object. This is the exact same pattern needed for `SetMeta`, and for the `EFFECT_ON_METHOD_KEY` used to prevent double-logging.
- **Key files**:
  - `src/log.decorator.ts:239-246` — current implementation to extract into `SetMeta`
  - `src/decorate/applyToClass.ts:23-24` — current check `value[NO_LOG_METADATA_KEY] === true` to replicate for `EFFECT_ON_METHOD_KEY`

### Pattern 2: Argument-count Decorator Detection (existing)

- **Location**: `src/log.decorator.ts:174-183`
- **Why relevant**: `Effect.ts` must replicate the `propertyKey === undefined` check for class vs method dispatch.
- **Key files**:
  - `src/log.decorator.ts:174-183` — detection logic to copy into `Effect.ts`

---

## Test Coverage

### Existing Tests to Update

| Test File | Tests Affected | Update Required |
|-----------|----------------|-----------------|
| `tests/log.decorator.spec.ts:333-346` | `'should throw error if logger property is not found'` | Remove or replace with: "should auto-inject logger and work without explicit logger property" |
| `tests/log.decorator.spec.ts:604-649` | `'should work with mixed class-level and method-level decorators'` | Add explicit `expect(mockLogger.log).toHaveBeenCalledTimes(1)` assertion per invocation to verify no double-logging. **Confirmed by running `npm run test`**: the existing test uses only `toHaveBeenCalledWith` (not `toHaveBeenCalledTimes`), so it does NOT currently catch the double-logging bug. A double-logging regression would pass the existing assertions silently. |

### New Tests Needed

| Test Type | Location | Coverage Target |
|-----------|----------|-----------------|
| Unit | `tests/decorators/EffectOnMethod.spec.ts` | `onInvoke`, `afterReturn`, `onError`, `finally` hooks; `EFFECT_ON_METHOD_KEY` is set on wrapped fn; `getParameterNames` extraction |
| Unit | `tests/decorators/EffectOnClass.spec.ts` | Skips constructor; skips `NO_LOG_METADATA_KEY` methods; skips `EFFECT_ON_METHOD_KEY` methods (method-level priority) |
| Unit | `tests/decorators/Effect.spec.ts` | Class+method on same method logs exactly once (double-logging fix) |
| Unit | `tests/decorators/SetMeta.spec.ts` | `setMeta`/`getMeta` round-trip; `SetMeta` decorator sets value retrievable by `getMeta` |
| Unit | `tests/decorators/OnInvokeHook.spec.ts` | Thin wrapper fires `onInvoke` callback |
| Unit | `tests/decorators/AfterReturnHook.spec.ts` | Thin wrapper fires `afterReturn` callback |
| Unit | `tests/decorators/OnErrorHook.spec.ts` | Thin wrapper fires `onError` callback |
| Unit | `tests/decorators/FinallyHook.spec.ts` | Thin wrapper fires `finally` callback |
| Integration | `tests/log.decorator.spec.ts` | `@Log()` on class with no `logger` property auto-injects NestJS Logger and logs correctly |
| Integration | `tests/log.decorator.spec.ts` | `@Log()` on method with no `logger` property auto-injects NestJS Logger and logs correctly |
| Integration | `tests/log.decorator.spec.ts` | `@Log()` on class + `@Log()` on same method — success logged exactly once, not twice |

---

## Risk Assessment

### High Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Breaking public API | `applyToMethod`, `applyToClass`, `getParameterNames`, `handleAsyncExecution` are all currently exported. Removing them is a semver major change. | Task explicitly accepts breaking changes. Ensure new exports (`EffectOnMethod`, etc.) cover the same use cases. Consider whether `getParameterNames` should be re-exported from `EffectOnMethod.ts`. |
| Logger auto-injection side effects | Injecting `logger` onto `target.prototype` at class decoration time mutates the prototype permanently. If two instances of the same class use different loggers, the injected one is shared. But since NestJS Logger contexts are class-level anyway, this is acceptable. | Document the behavior; the injected logger uses `target.name` as context, same as the conventional `new Logger(ClassName.name)`. |
| TypeScript strict mode compatibility | Setting `(this as any).logger = ...` or `target.prototype.logger = ...` without declaration may trip `noImplicitAny` or prototype mutation warnings. | Use explicit type assertions; ensure `src/LogWrapper.ts` import of `Logger` from `@nestjs/common` is present (it already is at line 1). |
| Double-logging fix with `@NoLog() + @Log()` on same method | The test at line 824 has `@NoLog()` stacked on `@Log({ onInvoke: true })`. After refactor, EffectOnClass sees `EFFECT_ON_METHOD_KEY` set by `@Log()` and skips the method entirely (method-level wins). The `@NoLog()` symbol is irrelevant because EffectOnClass skips before checking it. Behavior remains consistent. | Verify with dedicated test case. |
| `finally` as a method/property name | `finally` is a reserved word in some contexts. The EffectOptions interface field named `finally` needs careful handling in TypeScript (must be quoted if used as computed property). | In TypeScript interfaces, `finally` can be used as a property name without quoting. Verify during implementation. |
| Subclass inheritance of `@EffectOnMethod`-decorated methods | If a base class method has been wrapped by `EffectOnMethod` (and therefore has `EFFECT_ON_METHOD_KEY` set on `descriptor.value`), a subclass decorated with `@EffectOnClass` will see that flag on the inherited prototype method and skip it entirely — even though the subclass has not applied `EffectOnMethod` itself. This means subclass-level class decoration silently provides no coverage for inherited methods, which may be surprising. | Document this behavior explicitly. If blanket coverage of inherited methods is needed, developers must apply `@EffectOnMethod` on the method in the subclass, or `@EffectOnClass` on the base class (not the subclass). Add a test case in `EffectOnClass.spec.ts` that verifies this inheritance behavior. |

---

## Recommended Exploration

Before implementation, developer should read:

1. `/workspaces/nestjs-log-decorator/src/decorate/applyToMethod.ts` — This is the primary source of logic for `EffectOnMethod`. The `getParameterNames` function declaration starts at line 61 (body spans lines 62-71) and `handleAsyncExecution` at line 77-87 move verbatim.
2. `/workspaces/nestjs-log-decorator/src/decorate/applyToClass.ts` — This is the source of logic for `EffectOnClass`. The NoLog-check at lines 23-24 must be extended to also check `EFFECT_ON_METHOD_KEY`.
3. `/workspaces/nestjs-log-decorator/src/log.decorator.ts:239-246` — The `NoLog` implementation is the direct pattern for `SetMeta`. The `Log` decorator at lines 166-186 is the source for `Effect` composition pattern.
4. `/workspaces/nestjs-log-decorator/tests/log.decorator.spec.ts:604-649` — The mixed-decorator test defines the expected behavior contract after the double-logging fix. Implementation must satisfy this test.
5. `/workspaces/nestjs-log-decorator/src/LogWrapper.ts:63-83` — `isLoggable` and `createLogWrapper` are the two functions changed by the Feature. The auto-injection goes where the current `throw` statement is at line 79.

---

## Verification Summary

| Check | Status | Notes |
|-------|--------|-------|
| All affected files identified | OK | 5 modify, 16 create, 2 delete — summary and body now consistent |
| Integration points mapped | OK | index.ts, log.decorator.ts, LogWrapper.ts, src/types.ts all traced |
| Similar patterns found | OK | NoLog symbol pattern, argument-count detection pattern |
| Test coverage analyzed | OK | 2 existing tests need changes; 8 new test files needed; double-logging gap empirically confirmed by test run |
| Risks assessed | OK | 6 risk areas documented (added subclass inheritance edge case) |

**Limitations/Caveats:**
- The `EffectOptions` callback signatures in the task spec include `descriptor` as a parameter. During implementation, verify that `descriptor` is actually needed in `onInvoke`/`afterReturn`/`onError`/`finally` callbacks, or simplify if not. The task says "adjust interface if needed".
- The `src/decorators/` folder must have zero imports from `@nestjs/common` or any logger-related modules. The Log-specific logic (logger injection, prettifyAxiosError calls) belongs exclusively in `src/log.decorator.ts` and `src/LogWrapper.ts`.
