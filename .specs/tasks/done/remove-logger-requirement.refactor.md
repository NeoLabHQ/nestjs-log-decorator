---
title: Remove requirement to define logger property on class to use decorator
---

## Initial User Prompt

remove requiremetn to set logger for class, in order to use decorator

### Context

Current implementation of Log decorator requires to implement `readonly logger = new Logger(YourClass.name)` in the class, and esentially implement Loggable interface in LogWrapper.ts.

### Requirements

#### Refactor

To simplify this implementation and future development, before implementing this task, firstly refactor this logger by extracting part of logic into new decorators. Create src/decorators folder with separate decorator per file:
    - EffectOnMethod decorator - it should receive following options {
            onInvoke?: (argsObject, targetObject, propertyKey, descriptor) => void,
            afterReturn?: (argsObject, targetObject, propertyKey, result: R, descriptor) => R,
            onError?: (argsObject, targetObject, propertyKey, error: Error, descriptor) => R,
            finally?: (argsObject, targetObject, propertyKey, descriptor) => R
        }
        move applyToMethod logic there and rewrite, so it can be used as a decorator. (adjust interface if it's needed)
    - EffectOnClass decorator - move applyToClass logic there. It should support same interface as EffectOnMethod
    - Effect that support same interface as EffectOnMethod and EffectOnClass, but can be applied to method and class. Move Log decorator logic composition there.
    - Create SetMeta decorator that will be used to set metadata on target object, it should use setMeta function inside that allow to set metadata to descriptor. Add in this file also add getMeta function that allow to get metadata from descriptor (they both should accept symbol as a key)
    - Create OnInvokeHook, AfterReturnHook, OnErrorHook, FinallyHook decorators that inside should use Effect. They are not used directly right now, but will be used in future.
- Rebuild Log decorator based on Effect decorator.
- Rebuild NoLog decorator based on SetMetadata decorator.
- write tests for all new decorators and update existing tests
- CRITICAL: avoid any code dublication, all decorators together combines (including Log and NoLog) should reuse each other.
- write jsdoc for all decotars, keep old decorators jsdoc preserved.
- do not keep applyToMethod and applyToClass, even if it breaking change, it acceptable.
- src/decorators folder should be abstract and avoid any logger related logic and types, it can be used as a base for other decorators libraries.
- keep Log and NoLog decorator interface and usage as it now, only change internal logic.

#### Fix

in this example
```ts
import { Injectable, Logger } from '@nestjs/common';
import { Log, NoLog } from 'nestjs-log-decorator';

@Log()
@Injectable()
export class OrderService {
  readonly logger = new Logger(OrderService.name);

  constructor(
    readonly orderRepo: OrderRepository,
    readonly paymentGateway: PaymentGateway,
  ) {}

  // Logged with invocation + custom args (exclude sensitive card data)
  @Log({
    onInvoke: true,
    args: (orderId: number, _cardDetails: CardDetails) => ({ orderId })
  })
  async processPayment(orderId: number, cardDetails: CardDetails) {
    const result = await this.paymentGateway.charge(orderId, cardDetails);
    return result;
  }
}
```

Logging will be done twice for processPayment, because both decorators wrap it.

- Need add verification key per method in order to avoid double logging (or other fix).
- Important to keep method decorator higher priority than class decorator.
- Fix this directly in Effect, EffectOnClass, EffectOnMethod. So it will be easier to maintain and extend in future.
- add tests for this scenario, in both Effect and Log decorators.


#### Feature

- Remove Loggable requirement, by directly injecting the logger property into target class during log decorator creation, if it not exists. By directly import from @nestjs/common.
- Injected logger should receive target class name as param.
- Remove LoggableConstructor in log decorator to allow any type of class to be decorated by Log decorator
- update tests and readme to reflect new changes.


# Description

> **Required Skill**: You MUST use and analyse `nestjs-log-decorator-refactor` skill before doing any modification to task file or starting implementation of it!
>
> Skill location: `.claude/skills/nestjs-log-decorator-refactor/SKILL.md`

This task encompasses three interconnected changes to the nestjs-log-decorator library: an architectural refactor, a bug fix, and a feature enhancement.

The primary user-facing change is removing the requirement for classes to define a `logger` property in order to use the `@Log()` decorator. Currently, every class using `@Log()` must include `readonly logger = new Logger(ClassName.name)`, and failing to do so causes a runtime error. After this change, the decorator will automatically inject a NestJS Logger (using the class name as context) when no logger property exists on the class instance. Classes that already define a logger property will continue to use their existing logger unchanged. This reduces onboarding friction, eliminates a common source of runtime errors, and simplifies the minimal usage example to just applying `@Log()` with no additional setup.

A bug fix is also required: when a class has both `@Log()` at the class level and `@Log({onInvoke: true})` on a specific method, that method currently gets wrapped twice, producing duplicate log entries. The fix must ensure that method-level decorators take priority over class-level decorators, and that no method is wrapped more than once by the same decorator type.

To enable both the fix and future extensibility, the internal architecture must be refactored first. The current `applyToMethod` and `applyToClass` modules will be replaced by a set of generic, reusable decorator primitives. These primitives (Effect, EffectOnMethod, EffectOnClass, SetMeta/getMeta, and lifecycle hook decorators) must be completely abstract with no logging-specific logic, enabling reuse as a foundation for other decorator libraries. Log and NoLog will be rebuilt on top of these primitives while preserving their existing consumer-facing API and usage patterns.

**Scope**:
- Included:
  - New generic decorator primitives (EffectOnMethod, EffectOnClass, Effect, SetMeta/getMeta, OnInvokeHook, AfterReturnHook, OnErrorHook, FinallyHook)
  - Rebuild of Log decorator using Effect, with auto-injection of NestJS Logger when no logger property exists
  - Rebuild of NoLog decorator using SetMeta
  - Fix for double-logging when mixing class-level and method-level `@Log()`
  - Removal of LoggableConstructor type constraint from Log decorator so any class can be decorated
  - Removal of `applyToMethod` and `applyToClass` legacy modules and their exports
  - JSDoc for all new decorators; preservation of existing JSDoc on Log and NoLog
  - Tests for all new and modified decorators
  - README updates reflecting the removed logger requirement
- Excluded:
  - Changes to Axios error handling or prettification logic
  - Changes to log output format or structured log entry shape
  - Changes to build system, CI/CD pipeline, or release process
  - New consumer-facing decorator features beyond those specified
  - Publishing a new version

**Public API Changes**:
- Removed exports (breaking change): `applyToMethod`, `applyToClass`, `getParameterNames`, `handleAsyncExecution`
- Preserved exports (no change): `Log`, `NoLog`, `LogOptions`, `LogArgsFormatter`, `NO_LOG_METADATA_KEY`, `LogWrapper`, `Loggable`, `isLoggable`, `createLogWrapper`, `buildArgsObject`, `prettifyAxiosError`, `isAxiosError`, `isTimeoutError`
- Changed exports: `Loggable` and `isLoggable` remain exported but are no longer required for `@Log()` usage (they become convenience utilities)
- New exports: `Effect`, `EffectOnMethod`, `EffectOnClass`, `SetMeta`, `getMeta`, `OnInvokeHook`, `AfterReturnHook`, `OnErrorHook`, `FinallyHook`

**User Scenarios**:
1. **Primary Flow**: Developer applies `@Log()` to a class without defining a logger property; methods are automatically logged using an auto-injected Logger with the class name as context, in the standard structured format
2. **Existing Logger Preserved**: Developer applies `@Log()` to a class that already has a logger property; the existing logger is used without overwriting
3. **Mixed Decorators**: Developer uses class-level `@Log()` plus method-level `@Log({onInvoke: true})`; only the method-level configuration takes effect for that method, with no duplicate log entries
4. **Method Error**: Method throws an error; the error is logged (with Axios prettification if applicable) and re-thrown, preserving the original stack trace
5. **Anonymous Class**: Developer applies `@Log()` to a class expression with no explicit name; logger is created with an empty string context and no runtime crash occurs
6. **Class Inheritance**: Developer applies `@Log()` to a subclass; inherited prototype methods are wrapped and logged
7. **Getters and Setters**: Developer applies `@Log()` to a class that has getters/setters; only plain methods are wrapped, getters and setters are left untouched

---

## Acceptance Criteria

### Functional Requirements

- [X] **Auto-injection of logger when not present**: When a class decorated with `@Log()` does not define a `logger` property, a logger is automatically created using the class name as context, and method calls produce structured log entries
  - Given: A class decorated with `@Log()` that does not define a `logger` property
  - When: A method on that class is called
  - Then: The method call produces a structured log entry with `{method, state, args}` format, using the class name as the logger context

- [X] **Existing logger is preserved**: When a class decorated with `@Log()` defines its own `logger` property, that logger receives all log output and no new logger is injected
  - Given: A class decorated with `@Log()` that defines its own `logger` property (e.g., a mock logger)
  - When: A method on that class is called
  - Then: The class's existing logger receives the log call (verifiable by checking mock call count), and no additional logger is created

- [X] **No double-logging with mixed decorators**: When a class has `@Log()` at class level and `@Log()` on a specific method, each method call produces exactly one set of log entries
  - Given: A class with `@Log()` at class level and `@Log({onInvoke: true})` on a specific method
  - When: That method is called once
  - Then: Exactly one "invoked" log entry and exactly one "success" (or "error") log entry is produced (total of 2 log calls, not 4)

- [X] **Method-level decorator takes priority over class-level**: When both class-level and method-level `@Log()` target the same method, the method-level configuration determines the behavior
  - Given: A class with `@Log()` at class level (no onInvoke) and `@Log({onInvoke: true})` on a specific method
  - When: That method is called
  - Then: The "invoked" log entry is present (proving method-level onInvoke:true took effect, not class-level default)

- [X] **Success logging preserves structured format**: Successful method calls produce a log entry with the exact structure `{method: string, state: 'success', args: object|undefined}`
  - Given: A class with `@Log()` and a method that returns a value
  - When: The method is called with arguments
  - Then: `logger.log()` is called with `{method: '<methodName>', state: 'success', args: {<paramName>: <value>}}`

- [X] **Error logging preserves structured format and re-throws**: Failed method calls produce an error log entry and re-throw the original error
  - Given: A class with `@Log()` and a method that throws an Error
  - When: The method is called
  - Then: `logger.error()` is called with `{method: '<methodName>', state: 'error', args: {<paramName>: <value>}, error: <Error>}`, and the original error is re-thrown to the caller

- [X] **Invocation logging when onInvoke is enabled**: Methods with `onInvoke: true` produce an "invoked" log entry before execution, followed by a "success" or "error" entry after
  - Given: A method decorated with `@Log({onInvoke: true})`
  - When: The method is called
  - Then: `logger.log()` is called first with `{method, state: 'invoked', args}`, then with `{method, state: 'success', args}` after the method completes

- [X] **Custom args formatter**: The `args` option allows consumers to control which arguments are logged
  - Given: A method decorated with `@Log({args: (id: number) => ({id})})`
  - When: The method is called with arguments `(1, largeObject)`
  - Then: The log entry's `args` field contains only `{id: 1}`, not the full argument list

- [X] **No-argument methods log args as undefined**: Methods with no parameters produce `args: undefined` in log entries
  - Given: A method decorated with `@Log()` that takes no parameters
  - When: The method is called
  - Then: The log entry contains `args: undefined`

- [X] **Axios errors are prettified**: When a method throws an Axios error, the error field in the log entry contains prettified Axios error data with `name`, `error`, `code`, and `config` fields
  - Given: A method decorated with `@Log()` that throws an AxiosError
  - When: The method is called
  - Then: The log entry's `error` field contains an object with `name: 'AxiosError'`, `error`, `code`, and `config` properties (not the raw AxiosError instance)

- [X] **Non-Axios errors are logged as Error instances**: When a method throws a regular Error, the error is logged as-is without prettification
  - Given: A method decorated with `@Log()` that throws a regular Error
  - When: The method is called
  - Then: The log entry's `error` field is the original Error instance

- [X] **Async methods are handled identically to sync methods**: Both synchronous and asynchronous methods produce the same structured log entries
  - Given: An async method decorated with `@Log()`
  - When: The method is called and its promise resolves or rejects
  - Then: The same structured log entries are produced as for a synchronous method (success on resolve, error on reject with re-throw)

- [X] **Constructor is never wrapped by class-level decorator**: When `@Log()` is applied to a class, the constructor is excluded from wrapping
  - Given: A class decorated with `@Log()` that has a constructor
  - When: A new instance is created
  - Then: No log entries are produced during construction

- [X] **NoLog exclusion works with class-level decorator**: Methods marked with `@NoLog()` are excluded from class-level `@Log()` logging
  - Given: A class with `@Log()` at class level and `@NoLog()` on a specific method
  - When: The `@NoLog()`-marked method is called
  - Then: No log entries are produced for that method, but the method still executes normally (including throwing errors if applicable)

- [X] **Method-level @Log() overrides @NoLog() on the same method**: When both `@NoLog()` and `@Log()` are applied to the same method within a class-level `@Log()` class, the method-level `@Log()` takes priority
  - Given: A class with `@Log()` at class level, and a method with both `@NoLog()` and `@Log({onInvoke: true})`
  - When: The method is called
  - Then: The method IS logged with invocation logging (method-level `@Log()` wins over `@NoLog()`)

- [X] **Any class can be decorated without type constraints**: The `@Log()` decorator can be applied to any class regardless of whether it implements specific interfaces or defines specific properties
  - Given: A plain class with no logger property and no special interface implementation
  - When: `@Log()` is applied to the class
  - Then: The decorator is accepted without errors (no type constraint prevents decoration)

### Edge Case Requirements

- [X] **Anonymous class handling**: When `@Log()` is applied to a class expression with no explicit name, the decorator does not crash and creates a logger with an empty or best-effort context string
  - Given: A class expression with no name (e.g., `const Svc = Log()(class { method() { return 1; } })`)
  - When: A method on an instance is called
  - Then: The method is logged without a runtime error; the logger context is an empty string or the assigned variable name (depending on runtime behavior)

- [X] **Class inheritance**: When `@Log()` is applied to a subclass, inherited methods defined on the parent prototype are also wrapped
  - Given: A parent class with a method `parentMethod()`, and a subclass decorated with `@Log()`
  - When: `parentMethod()` is called on an instance of the subclass
  - Then: A log entry is produced for `parentMethod()`

- [X] **Getters and setters are not wrapped**: Class-level `@Log()` does not attempt to wrap getter or setter property descriptors
  - Given: A class decorated with `@Log()` that defines a getter and/or setter
  - When: The getter or setter is accessed
  - Then: No log entry is produced and the getter/setter behaves normally (no wrapping occurs)

- [X] **Lifecycle hook error propagation**: If an Effect lifecycle hook (e.g., afterReturn or onError) itself throws an error, that error propagates to the caller rather than being silently swallowed
  - Given: An EffectOnMethod decorator with an `afterReturn` hook that throws an error
  - When: The decorated method is called
  - Then: The hook's error propagates to the caller (it is not silently caught or ignored)

### Decorator Primitive Requirements

- [X] **EffectOnMethod handles sync and async methods**: The EffectOnMethod decorator invokes lifecycle hooks (onInvoke, afterReturn, onError, finally) at the correct points for both synchronous and asynchronous method execution
  - Given: EffectOnMethod applied to a synchronous or asynchronous method with all lifecycle hooks configured
  - When: The method is called and succeeds
  - Then: onInvoke is called before execution, afterReturn is called after execution with the return value, and finally is called last
  - When: The method is called and throws
  - Then: onInvoke is called before execution, onError is called with the thrown error, and finally is called last

- [X] **EffectOnClass wraps all non-excluded prototype methods**: The EffectOnClass decorator wraps every method on the prototype except the constructor and methods marked for exclusion via metadata
  - Given: EffectOnClass applied to a class with 3 methods (one marked for exclusion via SetMeta) and a constructor
  - When: Each method and the constructor are called
  - Then: 2 methods are wrapped (hooks fire), the excluded method and constructor are not wrapped (no hooks fire)

- [X] **SetMeta and getMeta provide symbol-keyed metadata storage**: Metadata set on a method descriptor via SetMeta with a Symbol key can be retrieved via getMeta with the same Symbol key
  - Given: A method with metadata set via SetMeta using a specific Symbol key and a boolean value
  - When: getMeta is called with the same Symbol key on the same method descriptor
  - Then: The boolean value originally set is returned

- [X] **Lifecycle hook decorators invoke their corresponding hook**: OnInvokeHook, AfterReturnHook, OnErrorHook, and FinallyHook each fire their associated callback at the correct lifecycle point
  - Given: A method decorated with OnInvokeHook providing a callback function
  - When: The method is called
  - Then: The callback is invoked before the method executes (and similarly for afterReturn on success, onError on failure, finally always)

- [X] **No code duplication across decorator primitives**: All decorators compose and reuse each other -- Effect delegates to EffectOnMethod/EffectOnClass, Log uses Effect, NoLog uses SetMeta, lifecycle hook decorators use Effect
  - Given: The decorator implementations
  - When: The composition hierarchy is reviewed
  - Then: No wrapping, iteration, or lifecycle management logic is duplicated; each concern exists in exactly one place

### Non-Functional Requirements

- [X] **Zero new runtime dependencies**: No new runtime dependencies are added to the package; the sole peer dependency remains `@nestjs/common`

### Definition of Done

- [X] All acceptance criteria verified by passing tests
- [X] All existing tests pass (adapted as needed for the removed logger requirement; the existing test suite serves as the behavioral contract)
- [X] New tests cover: auto-injection, double-log prevention, all decorator primitives, and all edge cases listed above
- [X] JSDoc documentation present on all new exported decorators, functions, and types
- [X] README updated to reflect that the logger property is optional (auto-injected if missing)
- [X] Code reviewed
- [X] The abstract decorator primitives contain no logging-specific code and no NestJS-specific imports
- [X] Legacy `applyToMethod` and `applyToClass` modules are removed and no longer exported
- [X] All decorators compose and reuse each other with no duplicated logic

---

## Architecture

### References

- **Skill**: `.claude/skills/nestjs-log-decorator-refactor/SKILL.md`
- **Codebase Analysis**: `.specs/analysis/analysis-remove-logger-requirement.md`
- **Scratchpad**: `.specs/scratchpad/478121ba.md`

### Solution Strategy

**Architecture Pattern**: Layered + Microkernel -- The `src/decorators/` folder forms a microkernel of generic, reusable decorator primitives (the extension mechanism), while `Log`/`NoLog` are logging-specific "plugins" built on top. The generic layer has zero NestJS imports; the logging layer imports from the generic layer but never vice versa.

**Approach**: Introduce a generic, logger-agnostic decorator primitive layer in `src/decorators/` built on three core abstractions -- `SetMeta/getMeta` for symbol-keyed metadata, `EffectOnMethod` for lifecycle-hook method wrapping with double-wrap prevention, and `EffectOnClass` for prototype-iteration class decoration. These compose into a unified `Effect` decorator. `Log` is rebuilt as a thin logging-specific layer on top of `Effect`, while `NoLog` becomes a one-liner using `SetMeta`. Auto-logger injection uses a prototype getter/setter pattern that lazily creates a NestJS `Logger` instance, preserving user-defined loggers via instance-level property precedence.

**Key Decisions**:
1. **Metadata storage via `_symMeta` Map on function objects**: Multiple metadata keys coexist cleanly in a single Map, and the Map is copyable when `EffectOnMethod` wraps a function (preserving metadata like `NO_LOG_METADATA_KEY` through wrapping). This evolves the existing direct-symbol pattern at `log.decorator.ts:243`.
2. **EFFECT_APPLIED_KEY sentinel for double-wrap prevention**: `EffectOnMethod` sets this symbol on the wrapped function. `EffectOnClass` checks it before wrapping, skipping already-decorated methods. TypeScript's decorator evaluation order (method decorators run before class decorators) ensures method-level config takes priority.
3. **Prototype getter/setter for auto-logger injection**: `injectLoggerIfMissing` defines a getter on `target.prototype` that lazily creates `new Logger(this.constructor.name)`, with a setter that allows user-defined `readonly logger = new Logger(...)` class field assignments to override it via own-property precedence. For method-level `@Log()` without a class decorator, `createLogWrapper` handles auto-injection at call time.
4. **`exclusionKey` parameter on `EffectOnClass`/`Effect`**: Instead of hardcoding `NO_LOG_METADATA_KEY` in the generic layer, `EffectOnClass` accepts an optional `exclusionKey` symbol. `Log` passes `NO_LOG_METADATA_KEY` as the exclusion key, keeping the decorator layer logger-agnostic.
5. **`getParameterNames` stays in logging layer**: It is logging-specific (parameter name extraction for log formatting). The generic `EffectHooks` receive raw `args: unknown[]` arrays; the `Log` decorator extracts param names at decoration time and closes over them in hook callbacks.

**Trade-offs Accepted**:
- Breaking change by removing `applyToMethod`, `applyToClass`, `getParameterNames`, `handleAsyncExecution` exports -- acceptable per task specification
- `_symMeta` Map is slightly more complex than direct symbol properties, but provides clean multi-key storage and copyability across function wrapping
- Auto-injected logger uses `this.constructor.name` which may be empty in minified builds -- acceptable since tsdown outputs CJS with preserved class names

---

### Architecture Decomposition

**Components**:

| Component | Responsibility | Dependencies | Layer |
|-----------|---------------|--------------|-------|
| `src/decorators/set-meta.decorator.ts` | Symbol-keyed metadata storage on function objects via `_symMeta` Map | None | Core (Decorator Infra) |
| `src/decorators/effect-on-method.ts` | Wrap single method with lifecycle hooks; mark with EFFECT_APPLIED_KEY; copy metadata from original to wrapped function | `set-meta.decorator` | Core (Decorator Infra) |
| `src/decorators/effect-on-class.ts` | Iterate prototype methods, skip constructor + EFFECT_APPLIED_KEY-marked + exclusionKey-marked methods, apply EffectOnMethod | `effect-on-method`, `set-meta.decorator` | Core (Decorator Infra) |
| `src/decorators/effect.decorator.ts` | Unified class+method decorator factory; detects class vs method by argument count | `effect-on-method`, `effect-on-class` | Core (Decorator Infra) |
| `src/decorators/on-invoke.hook.ts` | Thin Effect wrapper for onInvoke only | `effect.decorator` | Core (Decorator Infra) |
| `src/decorators/after-return.hook.ts` | Thin Effect wrapper for afterReturn only | `effect.decorator` | Core (Decorator Infra) |
| `src/decorators/on-error.hook.ts` | Thin Effect wrapper for onError only | `effect.decorator` | Core (Decorator Infra) |
| `src/decorators/finally.hook.ts` | Thin Effect wrapper for finally only | `effect.decorator` | Core (Decorator Infra) |
| `src/decorators/index.ts` | Barrel re-export of all decorator primitives | All decorator files | Core (Decorator Infra) |
| `src/log.decorator.ts` | Log + NoLog decorators with logging-specific hooks, auto-injection, getParameterNames | `Effect`, `SetMeta`, `LogWrapper`, `Logger` | Application (Logging) |
| `src/LogWrapper.ts` | Structured log output, Axios prettification, auto-inject Logger in createLogWrapper | `@nestjs/common Logger` | Application (Logging) |
| `src/types.ts` | LogOptions, LogArgsFormatter, NO_LOG_METADATA_KEY | None | Application (Logging) |

**Interactions**:

```
                    src/decorators/ (generic, logger-agnostic)
+-------------------------------------------------------------------+
|                                                                   |
|  SetMeta/getMeta <-- EffectOnMethod <-- EffectOnClass             |
|                              ^                ^                   |
|                              |                |                   |
|                              +---- Effect ----+                   |
|                                      ^                            |
|                                      |                            |
|               OnInvokeHook / AfterReturnHook / OnErrorHook /      |
|               FinallyHook                                         |
|                                                                   |
+-------------------------------------------------------------------+
                               ^
                               | imports
                               |
+-------------------------------+-----------------------------------+
|                    src/ (logging-specific)                         |
|                                                                   |
|  Log --uses--> Effect({onInvoke, afterReturn, onError})           |
|  Log --uses--> injectLoggerIfMissing(target)                      |
|  Log --uses--> LogWrapper, buildArgsObject, prettifyAxiosError    |
|                                                                   |
|  NoLog --uses--> SetMeta(NO_LOG_METADATA_KEY, true)               |
|                                                                   |
|  LogWrapper --uses--> Logger from @nestjs/common                  |
|                                                                   |
+-------------------------------------------------------------------+
```

---

### Expected Changes

```
src/
+-- decorators/
|   +-- index.ts                  # NEW: barrel re-exports
|   +-- set-meta.decorator.ts     # NEW: setMeta, getMeta, SetMeta
|   +-- effect-on-method.ts       # NEW: EffectOnMethod, EFFECT_APPLIED_KEY, EffectHooks
|   +-- effect-on-class.ts        # NEW: EffectOnClass
|   +-- effect.decorator.ts       # NEW: Effect unified decorator
|   +-- on-invoke.hook.ts         # NEW: OnInvokeHook thin wrapper
|   +-- after-return.hook.ts      # NEW: AfterReturnHook thin wrapper
|   +-- on-error.hook.ts          # NEW: OnErrorHook thin wrapper
|   +-- finally.hook.ts           # NEW: FinallyHook thin wrapper
+-- log.decorator.ts              # UPDATE: rebuild Log/NoLog using Effect/SetMeta, add auto-injection, move getParameterNames here
+-- LogWrapper.ts                 # UPDATE: createLogWrapper auto-injects Logger instead of throwing
+-- index.ts                      # UPDATE: remove decorate/ exports, add decorators/ exports
+-- types.ts                      # KEEP: unchanged
+-- decorate/
|   +-- applyToMethod.ts          # DELETE
|   +-- applyToClass.ts           # DELETE

tests/
+-- decorators/
|   +-- EffectOnMethod.spec.ts    # NEW: lifecycle hooks, async handling, EFFECT_APPLIED_KEY marking
|   +-- EffectOnClass.spec.ts     # NEW: prototype iteration, skip exclusion, skip already-wrapped
|   +-- Effect.spec.ts            # NEW: class+method dispatch, double-logging prevention
|   +-- SetMeta.spec.ts           # NEW: setMeta/getMeta round-trip, SetMeta decorator
|   +-- OnInvokeHook.spec.ts      # NEW: thin wrapper fires onInvoke
|   +-- AfterReturnHook.spec.ts   # NEW: thin wrapper fires afterReturn
|   +-- OnErrorHook.spec.ts       # NEW: thin wrapper fires onError
|   +-- FinallyHook.spec.ts       # NEW: thin wrapper fires finally
+-- log.decorator.spec.ts         # UPDATE: remove throw test, add auto-injection + double-log count assertions

README.md                         # UPDATE: remove logger requirement from examples
```

---

### Building Block View

```
+---------------------------------------------------------------+
|                      src/decorators/                          |
|                  (Generic Decorator Primitives)               |
|---------------------------------------------------------------|
|  +--------------+  +----------------+  +------------------+   |
|  |  SetMeta     |  | EffectOnMethod |  |  EffectOnClass   |   |
|  |  getMeta     |  | EFFECT_APPLIED |  |  (iterates       |   |
|  |  setMeta     |<-| EffectHooks    |<-|   prototype)     |   |
|  +--------------+  +-------+--------+  +--------+---------+   |
|                            |                     |             |
|                            +----------+----------+             |
|                                       v                        |
|                            +-----------------+                 |
|                            |     Effect      |                 |
|                            | (class+method)  |                 |
|                            +--------+--------+                 |
|                                     |                          |
|         +------------+---------+----+                          |
|         v            v         v         v                     |
|  +-----------+ +--------+ +------+ +---------+                 |
|  |OnInvoke   | |After   | |OnErr | |Finally  |                 |
|  |Hook       | |Return  | |Hook  | |Hook     |                 |
|  +-----------+ +--------+ +------+ +---------+                 |
+---------------------------------------------------------------+
                          ^
                          | imports (generic layer)
                          |
+--------------------------+------------------------------------+
|                    Logging Layer (src/)                        |
|---------------------------------------------------------------|
|  +------------------+      +--------------------+              |
|  |   Log decorator  |----->|   LogWrapper       |              |
|  |   (uses Effect)  |      |   buildArgsObject  |              |
|  |   injectLogger   |      |   isLoggable       |              |
|  |   getParamNames  |      |   createLogWrapper |              |
|  +------------------+      +--------------------+              |
|  +------------------+      +--------------------+              |
|  |  NoLog decorator |      |   types.ts         |              |
|  |  (uses SetMeta)  |      |   NO_LOG_KEY       |              |
|  +------------------+      |   LogOptions       |              |
|                            +--------------------+              |
+---------------------------------------------------------------+
```

---

### Runtime Scenarios

**Scenario: Auto-Logger Injection (Class-Level)**

```
@Log() on class
    |
    v
Effect(hooks, exclusionKey) --> EffectOnClass wraps prototype methods
    |
    v
injectLoggerIfMissing(target)
    |
    v
Object.defineProperty(target.prototype, 'logger', { get/set })
    |
    v
new MyClass()  -- no logger property defined by user
    |
    v
instance.method(args)
    |
    v
wrapped fn: hooks.afterReturn -> accesses this.logger
    |
    v
getter fires -> creates new Logger(this.constructor.name) -> caches on instance
    |
    v
LogWrapper.success() logs structured entry
```

**Scenario: Auto-Logger Injection (Method-Level Only)**

```
@Log() on method only (no class decorator)
    |
    v
EffectOnMethod wraps method, sets EFFECT_APPLIED_KEY
    |
    v
new MyClass() -- no logger, no prototype getter
    |
    v
instance.method(args)
    |
    v
wrapped fn: hooks call createLogWrapper(this, className, ...)
    |
    v
createLogWrapper: !isLoggable(this) -> instance.logger = new Logger(className)
    |
    v
LogWrapper logs structured entry
```

**Scenario: Double-Wrap Prevention**

```
Decoration order (TypeScript evaluates bottom-up for methods, then class):

1. @Log({onInvoke:true}) on method2 --> EffectOnMethod wraps, sets EFFECT_APPLIED_KEY
2. @Log() on class --> EffectOnClass iterates prototype:
   - method1: no EFFECT_APPLIED_KEY --> WRAP
   - method2: has EFFECT_APPLIED_KEY --> SKIP (preserves method-level config)
3. Result: method2 logged exactly once per call with onInvoke:true
```

**Scenario: @NoLog() with Class-Level @Log()**

```
1. @NoLog() on helperMethod --> SetMeta(NO_LOG_METADATA_KEY, true) on descriptor.value
2. @Log() on class --> EffectOnClass iterates prototype:
   - helperMethod: getMeta(exclusionKey=NO_LOG_METADATA_KEY) returns true --> SKIP
   - other methods: no flags --> WRAP
```

**Scenario: @NoLog() + @Log() on Same Method within Class-Level @Log()**

```
Decoration order (bottom-up):
1. @Log({onInvoke:true}) wraps method1, sets EFFECT_APPLIED_KEY
2. @NoLog() sets NO_LOG_METADATA_KEY on the WRAPPED function
3. @Log() class: EffectOnClass checks EFFECT_APPLIED_KEY FIRST --> SKIP
   (method-level @Log wins over @NoLog; EFFECT_APPLIED_KEY checked before exclusionKey)
```

---

### Architecture Decisions

#### Decision 1: Symbol Metadata via _symMeta Map

**Status**: Accepted

**Context**: Need to store multiple symbol-keyed metadata values on decorated function objects, copyable across function wrapping.

**Options**:
1. Direct symbol properties on function objects (current NoLog pattern)
2. `_symMeta` Map property on function objects
3. Module-level WeakMap
4. reflect-metadata package

**Decision**: Use `_symMeta` Map property on function objects (Option 2).

**Consequences**:
- Multiple metadata keys coexist in a single Map
- When EffectOnMethod wraps a function, it copies the Map from original to wrapped, preserving all metadata
- No new dependency required
- NoLog rebuilt to use setMeta (consistent metadata API)

#### Decision 2: exclusionKey Parameter for Logger-Agnostic Exclusion

**Status**: Accepted

**Context**: `EffectOnClass` needs to skip `@NoLog()`-marked methods, but `NO_LOG_METADATA_KEY` is logging-specific and must not appear in the generic layer.

**Options**:
1. Hardcode NO_LOG_METADATA_KEY in EffectOnClass
2. Pass exclusionKey as parameter
3. Only rely on EFFECT_APPLIED_KEY

**Decision**: Pass `exclusionKey` as optional parameter to `EffectOnClass` and `Effect` (Option 2).

**Consequences**:
- `src/decorators/` remains fully logger-agnostic
- `Log` passes `NO_LOG_METADATA_KEY` as exclusionKey
- Reusable for other decorator libraries with their own exclusion keys

#### Decision 3: getParameterNames in Logging Layer

**Status**: Accepted

**Context**: Parameter name extraction from function signatures is needed only for log formatting.

**Options**:
1. Move getParameterNames into generic decorator layer
2. Keep in logging layer

**Decision**: Keep in logging layer (`src/log.decorator.ts`) as local utility (Option 2).

**Consequences**:
- `src/decorators/` stays focused on lifecycle hooks with raw `args: unknown[]`
- Log decorator extracts param names at decoration time, closes over them in hook callbacks
- Generic decorator consumers handle their own arg formatting

---

### High-Level Structure

```
Feature: Remove Logger Requirement & Decorator Primitives
+-- Entry Point: @Log() / @NoLog() decorators (unchanged public API)
+-- Generic Layer: src/decorators/ (Effect, EffectOnMethod, EffectOnClass, SetMeta, hooks)
|   +-- Metadata: setMeta/getMeta with _symMeta Map
|   +-- Method Wrapping: EffectOnMethod with lifecycle hooks + EFFECT_APPLIED_KEY
|   +-- Class Wrapping: EffectOnClass with prototype iteration + exclusion
|   +-- Unified: Effect detects class vs method
+-- Logging Layer: Log/NoLog/LogWrapper/types
|   +-- Log: Effect + getParameterNames + LogWrapper + auto-injection
|   +-- NoLog: SetMeta(NO_LOG_METADATA_KEY, true)
|   +-- LogWrapper: createLogWrapper with auto-injection fallback
+-- Output: Structured log entries {method, state, args, error?}
```

---

### Workflow Steps

```
Phase 1: Generic Decorator Infrastructure (no existing code dependencies)
  1. src/decorators/set-meta.decorator.ts
  2. src/decorators/effect-on-method.ts
  3. src/decorators/effect-on-class.ts
  4. src/decorators/effect.decorator.ts
  5. 4 hook decorator files
  6. src/decorators/index.ts
  7. tests/decorators/ (8 test files)

Phase 2: Rebuild Log and NoLog (depends on Phase 1)
  8. Rewrite src/log.decorator.ts using Effect/SetMeta + auto-injection
  9. Update src/LogWrapper.ts (createLogWrapper auto-injects)

Phase 3: Wire Up Exports and Clean Up (depends on Phase 2)
  10. Update src/index.ts (swap exports)
  11. Delete src/decorate/applyToMethod.ts and applyToClass.ts

Phase 4: Tests and Documentation (depends on Phases 2-3)
  12. Update tests/log.decorator.spec.ts
  13. Update README.md

Phase 5: Verification
  14. npm run build && npm run test && npm run typecheck
```

---

### Contracts

**EffectHooks Interface** (generic, logger-agnostic):
```typescript
interface EffectHooks<R = unknown> {
  onInvoke?: (
    args: unknown[], target: object, propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => void;
  afterReturn?: (
    args: unknown[], target: object, propertyKey: string | symbol,
    result: R, descriptor: PropertyDescriptor
  ) => R;
  onError?: (
    args: unknown[], target: object, propertyKey: string | symbol,
    error: unknown, descriptor: PropertyDescriptor
  ) => R;
  finally?: (
    args: unknown[], target: object, propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => void;
}
```

**SetMeta/getMeta API**:
```typescript
function setMeta(key: symbol, value: unknown, descriptor: PropertyDescriptor): void;
function getMeta<T = unknown>(key: symbol, descriptor: PropertyDescriptor): T | undefined;
function SetMeta(key: symbol, value: unknown): MethodDecorator;
```

**Effect Unified Decorator**:
```typescript
function Effect<R = unknown>(
  options: EffectHooks<R>, exclusionKey?: symbol
): ClassDecorator & MethodDecorator;
```

**EffectOnMethod**:
```typescript
function EffectOnMethod<R = unknown>(options: EffectHooks<R>): MethodDecorator;
// Also exports: EFFECT_APPLIED_KEY: symbol
```

**EffectOnClass**:
```typescript
function EffectOnClass<R = unknown>(
  options: EffectHooks<R>, exclusionKey?: symbol
): ClassDecorator;
```

**Hook Decorators** (all follow same pattern):
```typescript
function OnInvokeHook(
  callback: EffectHooks['onInvoke']
): ClassDecorator & MethodDecorator;

function AfterReturnHook<R = unknown>(
  callback: EffectHooks<R>['afterReturn']
): ClassDecorator & MethodDecorator;

function OnErrorHook<R = unknown>(
  callback: EffectHooks<R>['onError']
): ClassDecorator & MethodDecorator;

function FinallyHook(
  callback: EffectHooks['finally']
): ClassDecorator & MethodDecorator;
```

---

## Implementation Process

You MUST launch for each step a separate agent, instead of performing all steps yourself. And for each step marked as parallel, you MUST launch separate agents in parallel.

**CRITICAL:** For each agent you MUST:
1. Use the **Agent** type specified in the step (e.g., `haiku`, `sonnet`, `sdd:developer`, `sdd:tech-writer`)
2. Provide path to task file and prompt which step to implement
3. Require agent to implement exactly that step, not more, not less, not other steps

### Parallelization Overview

```
Step 1 (SetMeta/getMeta + dirs)          Step 6 (LogWrapper auto-injection)
[sdd:developer]                          [sdd:developer]
(No deps)                                (No deps)
         |                                        |
         v                                        |
Step 2 (EffectOnMethod)                           |
[sdd:developer]                                   |
(Depends: Step 1)                                 |
         |                                        |
         v                                        |
Step 3 (EffectOnClass)                            |
[sdd:developer]                                   |
(Depends: Step 2)                                 |
         |                                        |
         v                                        |
Step 4 (Effect unified)                           |
[sdd:developer]                                   |
(Depends: Step 3)                                 |
         |                                        |
         v                                        |
Step 5 (Hook decorators + barrel)                 |
[sdd:developer]                                   |
(Depends: Step 4)                                 |
         |                                        |
         +-------------------+--------------------+
                             v
                    Step 7 (Rebuild Log/NoLog)
                    [sdd:developer]
                    (Depends: Step 5, Step 6)
                             |
           +-----------------+------------------+
           v                 v                  v
Step 8 (Tests)     Step 9 (Exports)    Step 10 (README)
[sdd:developer]    [haiku]             [sdd:tech-writer]
(Depends: 7)       (Depends: 7)        (Depends: 7)
(Parallel w/ 9,10) (Parallel w/ 8,10)  (Parallel w/ 8,9)
           |                 |                  |
           +---------+-------+------------------+
                     v
           Step 11 (Verification)
           [sdd:developer]
           (Depends: Step 8, Step 9, Step 10)
```

### Implementation Strategy

**Approach**: Bottom-Up (Building-Blocks-First)
**Rationale**: The core complexity lives in the generic decorator primitives -- lifecycle hook management in EffectOnMethod, metadata storage in SetMeta, and double-wrap prevention logic. The logging layer (Log/NoLog) is a thin consumer built on top. Bottom-up ensures each primitive is independently testable, the generic layer stays truly logger-agnostic (cannot accidentally import logging code), and integration issues surface at composition boundaries rather than deep in the stack.

### Decomposition Chain

```
Level 0: SetMeta/getMeta/setMeta        (zero deps - metadata foundation)
    |
Level 1: EffectOnMethod                 (depends on Level 0 for EFFECT_APPLIED_KEY + metadata copying)
    |
Level 2: EffectOnClass                  (depends on Level 0+1 for exclusion checks + delegation)
    |
Level 3: Effect                          (depends on Level 1+2 for class vs method dispatch)
    |
Level 4: Hook decorators + barrel        (depends on Level 3 - thin wrappers)
    |
Level 5: Rebuild Log/NoLog + LogWrapper  (depends on Level 3+4+LogWrapper for Effect/SetMeta)
    |
Level 6: Tests + Exports + README        (depends on Level 5 - can parallelize)
    |
Level 7: Verification                    (depends on Level 6)
```

### Dependencies Table

| Step | Subproblem | Depends On | Why This Order |
|------|------------|------------|----------------|
| 1 | SetMeta/getMeta + dirs | Nothing | Foundation metadata API used by all decorators |
| 2 | EffectOnMethod | Step 1 | Needs setMeta for EFFECT_APPLIED_KEY, copies metadata from original to wrapped function |
| 3 | EffectOnClass | Step 2 | Needs getMeta to check exclusion/already-wrapped, delegates wrapping to EffectOnMethod |
| 4 | Effect | Step 3 | Unified facade dispatching to EffectOnMethod or EffectOnClass |
| 5 | Hook decorators + barrel | Step 4 | Thin wrappers passing single hook to Effect; barrel re-exports all |
| 6 | LogWrapper auto-injection | Nothing | Independent of decorator layer; modifies existing file |
| 7 | Rebuild Log/NoLog | Step 5, Step 6 | Log uses Effect (via barrel), NoLog uses SetMeta, LogWrapper must be updated |
| 8 | Tests (update existing) | Step 7 | Validate rebuilt Log/NoLog against acceptance criteria |
| 9 | Exports + delete legacy | Step 7 | Swap exports after new code is in place |
| 10 | README | Step 7 | Document the changed API surface |
| 11 | Verification | Step 8, Step 9, Step 10 | Final build/test/typecheck after all changes |

---

### Step 1: Create Directories + Implement SetMeta/getMeta Metadata Primitives [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** None
**Parallel with:** Step 6

**Goal**: Create the `src/decorators/` and `tests/decorators/` directories, then implement the symbol-keyed metadata storage system that all other decorators depend on. This is the zero-dependency foundation of the entire decorator infrastructure.

#### Expected Output

- `src/decorators/` directory
- `tests/decorators/` directory
- `src/decorators/set-meta.decorator.ts`: `setMeta`, `getMeta`, `SetMeta` decorator factory
- `tests/decorators/SetMeta.spec.ts`: Unit tests for all three exports

#### Success Criteria

- [X] Directory `src/decorators/` exists
- [X] Directory `tests/decorators/` exists
- [X] `setMeta(symbol, value, descriptor)` stores a value in a `_symMeta` Map on `descriptor.value`
- [X] `getMeta(symbol, descriptor)` retrieves the stored value, returning `undefined` if not set
- [X] `SetMeta(symbol, value)` returns a MethodDecorator that calls `setMeta` on the decorated method's descriptor
- [X] Round-trip test passes: `setMeta` followed by `getMeta` returns the original value
- [X] `getMeta` on a descriptor without metadata returns `undefined`
- [X] `getMeta` on `undefined` descriptor returns `undefined` without crashing
- [X] Multiple metadata keys coexist on the same function without conflict
- [X] JSDoc present on all three exported functions
- [X] File contains zero imports from `@nestjs/common` or any logging-related module
- [X] All tests in `tests/decorators/SetMeta.spec.ts` pass: `npx vitest run tests/decorators/SetMeta.spec.ts`

#### Subtasks

- [X] Create `src/decorators/` directory
- [X] Create `tests/decorators/` directory
- [X] Define `setMeta` function in `src/decorators/set-meta.decorator.ts` that creates/accesses `_symMeta` Map on `descriptor.value`
- [X] Define `getMeta` function that reads from `_symMeta` Map, handling undefined descriptor and missing Map gracefully
- [X] Define `SetMeta` decorator factory that returns a MethodDecorator calling `setMeta`
- [X] Export `EffectHooks` interface from this file (shared type used by EffectOnMethod and others)
- [X] Write JSDoc for all three functions
- [X] Write `tests/decorators/SetMeta.spec.ts` with tests for: round-trip, missing metadata, undefined descriptor, multiple keys, SetMeta decorator usage

**Complexity**: Small
**Uncertainty**: Low

#### Verification

**Level:** Panel (2 Judges with Aggregated Voting)
**Artifact:** `src/decorators/set-meta.decorator.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Correctness | 0.30 | setMeta stores values in _symMeta Map on descriptor.value; getMeta retrieves them; round-trip works; undefined handling correct |
| API Design | 0.20 | Clean function signatures matching the specified contract; SetMeta returns proper MethodDecorator |
| Robustness | 0.20 | Handles undefined descriptor, missing Map, multiple keys coexisting without conflict |
| Layer Isolation | 0.15 | Zero imports from @nestjs/common or any logging-related module |
| Documentation | 0.15 | JSDoc present on all three exported functions with clear usage descriptions |

---

### Step 2: Implement EffectOnMethod Decorator [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 1
**Parallel with:** None

**Goal**: Create the core method-wrapping decorator that applies lifecycle hooks (onInvoke, afterReturn, onError, finally) to a single method, marks it with EFFECT_APPLIED_KEY, and copies metadata from the original function to the wrapped function. This is the most complex single component.

#### Expected Output

- `src/decorators/effect-on-method.ts`: `EffectOnMethod` decorator factory, `EFFECT_APPLIED_KEY` symbol, `EffectHooks` interface
- `tests/decorators/EffectOnMethod.spec.ts`: Comprehensive unit tests

#### Success Criteria

- [X] `EffectOnMethod(hooks)` returns a MethodDecorator that replaces `descriptor.value` with a wrapped function
- [X] `onInvoke` hook fires before the original method executes, receiving `(args, target, propertyKey, descriptor)`
- [X] `afterReturn` hook fires after successful sync execution, receiving `(args, target, propertyKey, result, descriptor)` and its return value replaces the method result
- [X] `onError` hook fires when the method throws, receiving `(args, target, propertyKey, error, descriptor)`
- [X] `finally` hook fires after both success and error paths
- [X] Async methods: `afterReturn` fires after promise resolves, `onError` fires after promise rejects, `finally` fires via `.finally()` on the promise chain
- [X] `EFFECT_APPLIED_KEY` symbol is set on the wrapped function via `setMeta`
- [X] `_symMeta` Map is copied from original function to wrapped function (preserving NoLog and other metadata)
- [X] Hooks are optional -- omitting a hook skips it without error
- [X] Error from `onError` hook propagates to caller (not swallowed)
- [X] If no `onError` hook, the original error is re-thrown
- [X] `this` context is preserved correctly in the wrapped function
- [X] File contains zero imports from `@nestjs/common`
- [X] JSDoc present on `EffectOnMethod`, `EFFECT_APPLIED_KEY`, and `EffectHooks`
- [X] All tests in `tests/decorators/EffectOnMethod.spec.ts` pass: `npx vitest run tests/decorators/EffectOnMethod.spec.ts`

#### Subtasks

- [X] Define `EffectHooks<R>` interface in `src/decorators/effect-on-method.ts` with `onInvoke`, `afterReturn`, `onError`, `finally` optional callbacks
- [X] Define `EFFECT_APPLIED_KEY` as exported `Symbol('effectApplied')`
- [X] Implement `EffectOnMethod<R>(hooks: EffectHooks<R>): MethodDecorator` that:
  - Saves original method reference
  - Creates wrapper function preserving `this`
  - Calls `onInvoke` if defined
  - Executes original method in try/catch
  - Detects Promise return for async path
  - Sync path: calls `afterReturn` on success, `onError` on error, `finally` always
  - Async path: chains `.then(afterReturn)`, `.catch(onError)`, `.finally(finally)`
  - Copies `_symMeta` from original to wrapped function
  - Sets `EFFECT_APPLIED_KEY` via `setMeta` on the new descriptor
- [X] Write JSDoc for all exports
- [X] Write `tests/decorators/EffectOnMethod.spec.ts` covering:
  - Sync method with all 4 hooks fires in correct order
  - Async method with all 4 hooks fires in correct order
  - Only `onInvoke` hook provided (others omitted)
  - Only `afterReturn` hook provided
  - `onError` hook receives the thrown error
  - `finally` hook fires on both success and error paths
  - `afterReturn` return value replaces method result
  - `this` context is correct inside wrapped method
  - `EFFECT_APPLIED_KEY` is set on wrapped function (verifiable via `getMeta`)
  - Metadata from original function is preserved on wrapped function
  - Hook that throws propagates error to caller
  - Method with no hooks applied (empty options) still executes normally

**Complexity**: Large
**Uncertainty**: Medium (async promise chaining and metadata copying are the complex parts)
**Risks**:
- `finally` as property name in TS interface: verified safe in interfaces, but test to confirm
- Async error path must re-throw correctly after `onError` hook

**Integration Points**: EffectOnClass (Step 3) will delegate to this; Effect (Step 4) will delegate to this

#### Verification

**Level:** CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/decorators/effect-on-method.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Lifecycle Correctness | 0.25 | All 4 hooks fire at correct points: onInvoke before execution, afterReturn after success, onError on throw, finally always last |
| Async Handling | 0.25 | Promise detection works; hooks chain correctly via .then/.catch/.finally; async errors re-thrown properly |
| Metadata Management | 0.20 | EFFECT_APPLIED_KEY set via setMeta on wrapped function; _symMeta Map copied from original to wrapped function |
| Error Propagation | 0.15 | onError hook errors propagate to caller; missing onError re-throws original; this context preserved |
| Layer Isolation & Docs | 0.15 | Zero @nestjs/common imports; JSDoc on EffectOnMethod, EFFECT_APPLIED_KEY, EffectHooks |

**Reference Pattern:** `src/decorate/applyToMethod.ts` (existing method wrapping logic being replaced)

---

### Step 3: Implement EffectOnClass Decorator [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 2
**Parallel with:** None

**Goal**: Create the class-level decorator that iterates prototype methods, skips constructor and excluded/already-wrapped methods, and applies EffectOnMethod to the rest.

#### Expected Output

- `src/decorators/effect-on-class.ts`: `EffectOnClass` decorator factory
- `tests/decorators/EffectOnClass.spec.ts`: Unit tests

#### Success Criteria

- [X] `EffectOnClass(hooks, exclusionKey?)` returns a ClassDecorator that iterates `Object.getOwnPropertyNames(target.prototype)`
- [X] Constructor is always skipped (never wrapped)
- [X] Non-function properties are skipped
- [X] Getters and setters are skipped (only `descriptor.value` that is `typeof function` gets wrapped)
- [X] Methods with `getMeta(EFFECT_APPLIED_KEY, descriptor)` returning truthy are skipped (double-wrap prevention)
- [X] Methods with `getMeta(exclusionKey, descriptor)` returning truthy are skipped (NoLog-style exclusion)
- [X] `EFFECT_APPLIED_KEY` is checked BEFORE `exclusionKey` (method-level @Log wins over @NoLog within class-level @Log)
- [X] Remaining methods are wrapped via `EffectOnMethod(hooks)` logic and property redefined on prototype
- [X] File contains zero imports from `@nestjs/common`
- [X] JSDoc present on `EffectOnClass`
- [X] All tests in `tests/decorators/EffectOnClass.spec.ts` pass: `npx vitest run tests/decorators/EffectOnClass.spec.ts`

#### Subtasks

- [X] Implement `EffectOnClass<R>(hooks: EffectHooks<R>, exclusionKey?: symbol): ClassDecorator` in `src/decorators/effect-on-class.ts` that:
  - Gets own property names from `target.prototype`
  - Skips `'constructor'`
  - Gets descriptor for each property
  - Skips if `descriptor.value` is not a function
  - Skips if `getMeta(EFFECT_APPLIED_KEY, descriptor)` is truthy
  - Skips if `exclusionKey` provided and `getMeta(exclusionKey, descriptor)` is truthy
  - Applies `EffectOnMethod(hooks)` to the descriptor
  - Redefines the property on prototype with the updated descriptor
- [X] Write JSDoc
- [X] Write `tests/decorators/EffectOnClass.spec.ts` covering:
  - Class with 3 methods: all get wrapped, hooks fire for each
  - Constructor is never wrapped
  - Method with EFFECT_APPLIED_KEY is skipped (simulated by pre-setting metadata)
  - Method with exclusionKey metadata is skipped
  - EFFECT_APPLIED_KEY checked before exclusionKey (method with both: EFFECT_APPLIED wins, method is skipped)
  - Getters/setters are not wrapped
  - Non-function properties are not wrapped
  - Class with no methods (only constructor): no errors
  - Inherited prototype methods are wrapped when @EffectOnClass applied to subclass

**Complexity**: Medium
**Uncertainty**: Low
**Risks**:
- Inherited methods on prototype: `Object.getOwnPropertyNames` only gets own properties. Need to decide if inherited methods should be wrapped. Per acceptance criteria, they should. May need to walk prototype chain or note that inherited methods are on parent prototype. The architecture says `getOwnPropertyNames` which matches current behavior in `applyToClass.ts`.

**Integration Points**: Effect (Step 4) delegates to this for class decorators

#### Verification

**Level:** CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/decorators/effect-on-class.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Iteration Correctness | 0.25 | Iterates Object.getOwnPropertyNames(target.prototype); skips constructor, non-functions, getters/setters |
| Double-Wrap Prevention | 0.30 | EFFECT_APPLIED_KEY checked BEFORE exclusionKey; already-wrapped methods skipped; correct priority order |
| Exclusion Logic | 0.20 | exclusionKey parameter works for NoLog-style exclusion; methods with exclusion metadata skipped |
| Delegation | 0.10 | Correctly applies EffectOnMethod to remaining methods and redefines property on prototype |
| Layer Isolation & Docs | 0.15 | Zero @nestjs/common imports; JSDoc present on EffectOnClass |

**Reference Pattern:** `src/decorate/applyToClass.ts` (existing class wrapping logic being replaced)

---

### Step 4: Implement Effect Unified Decorator [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 3
**Parallel with:** None

**Goal**: Create the unified decorator factory that detects whether it is applied to a class or a method (by argument count) and delegates to EffectOnClass or EffectOnMethod accordingly. This mirrors the current Log decorator dispatch pattern.

#### Expected Output

- `src/decorators/effect.decorator.ts`: `Effect` unified decorator factory
- `tests/decorators/Effect.spec.ts`: Unit tests including double-logging prevention

#### Success Criteria

- [X] `Effect(hooks, exclusionKey?)` returns a decorator that works on both classes and methods
- [X] When applied to a class (1 argument: constructor), delegates to `EffectOnClass(hooks, exclusionKey)`
- [X] When applied to a method (3 arguments: target, propertyKey, descriptor), delegates to `EffectOnMethod(hooks)`
- [X] Throws error if applied in an unsupported context
- [X] Double-logging prevention: class-level Effect + method-level Effect on same method results in hooks firing exactly once per call (method-level wins)
- [X] File contains zero imports from `@nestjs/common`
- [X] JSDoc present on `Effect`
- [X] All tests in `tests/decorators/Effect.spec.ts` pass: `npx vitest run tests/decorators/Effect.spec.ts`

#### Subtasks

- [X] Implement `Effect<R>(hooks: EffectHooks<R>, exclusionKey?: symbol)` in `src/decorators/effect.decorator.ts` that:
  - Returns a function accepting `(target, propertyKey?, descriptor?)`
  - If `propertyKey === undefined`: call `EffectOnClass(hooks, exclusionKey)(target)`
  - If `descriptor !== undefined`: call `EffectOnMethod(hooks)(target, propertyKey, descriptor)` and return result
  - Otherwise: throw Error
- [X] Write JSDoc
- [X] Write `tests/decorators/Effect.spec.ts` covering:
  - Effect applied to method: hooks fire correctly
  - Effect applied to class: all methods wrapped, hooks fire
  - Effect on class + Effect on method (same method): hooks fire exactly once (double-logging prevention test)
  - Effect on class with exclusionKey: excluded methods are skipped

**Complexity**: Small
**Uncertainty**: Low

#### Verification

**Level:** Single Judge
**Artifact:** `src/decorators/effect.decorator.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Dispatch Correctness | 0.35 | Class detection (1 arg) delegates to EffectOnClass; method detection (3 args) delegates to EffectOnMethod; error on invalid context |
| Double-Logging Prevention | 0.25 | Class-level + method-level Effect on same method fires hooks exactly once (method-level wins) |
| API Contract | 0.20 | Returns decorator usable on both classes and methods; exclusionKey passed through to EffectOnClass |
| Layer Isolation & Docs | 0.20 | Zero @nestjs/common imports; JSDoc on Effect |

---

### Step 5: Implement Hook Decorators and Barrel Export [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 4
**Parallel with:** None
**Note:** Individual hook decorators MUST be created in parallel by multiple sub-agents if the implementing agent supports it

**Goal**: Create the four thin lifecycle hook decorators (OnInvokeHook, AfterReturnHook, OnErrorHook, FinallyHook) and the barrel `index.ts` for `src/decorators/`.

#### Expected Output

- `src/decorators/on-invoke.hook.ts`: `OnInvokeHook` decorator
- `src/decorators/after-return.hook.ts`: `AfterReturnHook` decorator
- `src/decorators/on-error.hook.ts`: `OnErrorHook` decorator
- `src/decorators/finally.hook.ts`: `FinallyHook` decorator
- `src/decorators/index.ts`: Barrel re-exports of all decorator primitives
- `tests/decorators/OnInvokeHook.spec.ts`: Tests
- `tests/decorators/AfterReturnHook.spec.ts`: Tests
- `tests/decorators/OnErrorHook.spec.ts`: Tests
- `tests/decorators/FinallyHook.spec.ts`: Tests

#### Success Criteria

- [X] `OnInvokeHook(callback)` returns a decorator that wraps with `Effect({ onInvoke: callback })`
- [X] `AfterReturnHook(callback)` returns a decorator that wraps with `Effect({ afterReturn: callback })`
- [X] `OnErrorHook(callback)` returns a decorator that wraps with `Effect({ onError: callback })`
- [X] `FinallyHook(callback)` returns a decorator that wraps with `Effect({ finally: callback })`
- [X] Each hook decorator works on both classes and methods (delegates through Effect)
- [X] `src/decorators/index.ts` re-exports: `SetMeta`, `getMeta`, `setMeta`, `EffectOnMethod`, `EFFECT_APPLIED_KEY`, `EffectHooks`, `EffectOnClass`, `Effect`, `OnInvokeHook`, `AfterReturnHook`, `OnErrorHook`, `FinallyHook`
- [X] All files in `src/decorators/` contain zero imports from `@nestjs/common`
- [X] JSDoc present on all four hook decorators
- [X] All tests pass: `npx vitest run tests/decorators/`

| Sub-task | Description | Agent | Can Parallel |
|----------|-------------|-------|--------------|
| OnInvokeHook + test | Implement hook + write test file | sdd:developer | Yes |
| AfterReturnHook + test | Implement hook + write test file | sdd:developer | Yes |
| OnErrorHook + test | Implement hook + write test file | sdd:developer | Yes |
| FinallyHook + test | Implement hook + write test file | sdd:developer | Yes |
| Barrel index.ts | Create barrel re-exports (after all hooks) | sdd:developer | No (after hooks) |

#### Subtasks

- [X] Implement `OnInvokeHook` in `src/decorators/on-invoke.hook.ts` as `(cb) => Effect({ onInvoke: cb })`
- [X] Implement `AfterReturnHook` in `src/decorators/after-return.hook.ts` as `(cb) => Effect({ afterReturn: cb })`
- [X] Implement `OnErrorHook` in `src/decorators/on-error.hook.ts` as `(cb) => Effect({ onError: cb })`
- [X] Implement `FinallyHook` in `src/decorators/finally.hook.ts` as `(cb) => Effect({ finally: cb })`
- [X] Write JSDoc for each hook decorator
- [X] Create `src/decorators/index.ts` barrel file re-exporting all primitives
- [X] Write `tests/decorators/OnInvokeHook.spec.ts`: callback fires before method execution for both sync and async methods
- [X] Write `tests/decorators/AfterReturnHook.spec.ts`: callback fires after successful return
- [X] Write `tests/decorators/OnErrorHook.spec.ts`: callback fires on error
- [X] Write `tests/decorators/FinallyHook.spec.ts`: callback fires always (success and error paths)

**Complexity**: Medium (4 files + 4 test files, but each is trivial)
**Uncertainty**: Low

#### Verification

**Level:** Per-Hook Judges (5 separate evaluations in parallel)
**Artifacts:** `src/decorators/{on-invoke.hook.ts,after-return.hook.ts,on-error.hook.ts,finally.hook.ts,index.ts}`
**Threshold:** 4.0/5.0

**Rubric (per hook decorator):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Delegation Correctness | 0.35 | Wraps the single callback in Effect with the correct hook key (onInvoke/afterReturn/onError/finally) |
| Class+Method Support | 0.25 | Works on both classes and methods (inherits from Effect) |
| Layer Isolation | 0.20 | Zero @nestjs/common imports |
| Documentation | 0.20 | JSDoc present with clear description of when the hook fires |

**Rubric (barrel index.ts):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Export Completeness | 0.50 | Re-exports all specified symbols: SetMeta, getMeta, setMeta, EffectOnMethod, EFFECT_APPLIED_KEY, EffectHooks, EffectOnClass, Effect, all 4 hooks |
| No Extra Exports | 0.25 | Does not export internal implementation details |
| No Logic | 0.25 | Contains only re-export statements, no business logic |

---

### Step 6: Update LogWrapper for Auto-Injection [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** None
**Parallel with:** Step 1

**Goal**: Modify `createLogWrapper` in `src/LogWrapper.ts` to auto-inject a NestJS Logger instance on the target when no logger property exists, instead of throwing an error.

#### Expected Output

- `src/LogWrapper.ts` (updated): `createLogWrapper` auto-injects Logger

#### Success Criteria

- [X] `createLogWrapper` no longer throws when `isLoggable(instance)` returns false
- [X] When `isLoggable(instance)` returns false, `createLogWrapper` creates `new Logger(className)` and assigns it to `instance.logger`
- [X] When `isLoggable(instance)` returns true, the existing logger is used (no new Logger created)
- [X] `Loggable` interface and `isLoggable` function remain exported and unchanged
- [X] JSDoc on `Loggable` updated to note it is no longer required (auto-injected if missing)
- [X] `LogWrapper` class, `buildArgsObject` remain unchanged
- [X] Typecheck passes: `npx tsc --noEmit`

#### Subtasks

- [X] In `src/LogWrapper.ts`, modify `createLogWrapper` function (line 71-83):
  - Remove the `throw new Error(...)` when `!isLoggable(instance)`
  - Replace with: create `new Logger(className)` and assign to `(instance as any).logger`
  - Then proceed to create LogWrapper with the (now present) logger
- [X] Update JSDoc on `Loggable` interface to indicate it is optional (logger auto-injected)
- [X] Update JSDoc on `createLogWrapper` to reflect auto-injection behavior

**Complexity**: Small
**Uncertainty**: Low

#### Verification

**Level:** Single Judge
**Artifact:** `src/LogWrapper.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Auto-Injection Correctness | 0.35 | When isLoggable returns false, creates new Logger(className) and assigns to instance.logger |
| Backward Compatibility | 0.25 | When isLoggable returns true, existing logger used unchanged; Loggable/isLoggable still exported |
| Error Removal | 0.15 | No longer throws when logger missing; graceful fallback |
| Documentation Update | 0.15 | JSDoc on Loggable updated to note optional; createLogWrapper JSDoc updated |
| Type Safety | 0.10 | Typecheck passes; no unsafe casts beyond necessary (instance as any).logger |

---

### Step 7: Rebuild Log and NoLog Decorators [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5, Step 6
**Parallel with:** None

**Goal**: Rewrite the Log decorator to use Effect from the generic layer, add prototype getter/setter auto-injection for class-level usage, and rewrite NoLog to use SetMeta. Preserve the entire external API (LogDecorator interface, LogOptions, all existing behavior).

#### Expected Output

- `src/log.decorator.ts` (rewritten): Log uses Effect, NoLog uses SetMeta, LoggableConstructor removed, `getParameterNames` moved here as local utility, `injectLoggerIfMissing` added

#### Success Criteria

- [X] `Log(options?)` returns a decorator that works on both classes and methods (same external API)
- [X] `Log()` on a class delegates to `Effect(loggingHooks, NO_LOG_METADATA_KEY)` and then calls `injectLoggerIfMissing(target)`
- [X] `Log()` on a method delegates to `EffectOnMethod(loggingHooks)` (via Effect or directly)
- [X] Logging hooks use `createLogWrapper` to format and output log entries (preserving structured format)
- [X] `getParameterNames` is a local function in this file, extracted at decoration time (not at call time)
- [X] `injectLoggerIfMissing(target)` defines a prototype getter/setter on `target.prototype` for the `'logger'` property using the pattern from the architecture (lazy `new Logger(this.constructor.name)` with setter override)
- [X] `LoggableConstructor` type is removed; `LogDecorator` interface updated to accept any class
- [X] `NoLog()` is rewritten as `SetMeta(NO_LOG_METADATA_KEY, true)` (one-liner)
- [X] All existing JSDoc on `Log` and `NoLog` preserved/updated
- [X] `Log` and `NoLog` exports are preserved (same import paths for consumers)
- [X] No double-logging when class-level and method-level `@Log()` are both applied (via EFFECT_APPLIED_KEY)
- [X] Typecheck passes: `npx tsc --noEmit`

#### Subtasks

- [X] Add `injectLoggerIfMissing(target: Function)` function to `src/log.decorator.ts`:
  - Check `'logger' in target.prototype` -- if exists, return early
  - Define getter/setter on `target.prototype` for `'logger'` property
  - Getter: lazily create `new Logger(this.constructor.name)`, cache on instance via symbol
  - Setter: `Object.defineProperty(this, 'logger', { value, writable: true, enumerable: true, configurable: true })`
- [X] Move `getParameterNames` from `src/decorate/applyToMethod.ts` to `src/log.decorator.ts` as a local (non-exported) function
- [X] Rewrite `Log` decorator body:
  - Remove imports of `applyToClass`, `applyToMethod`
  - Import `Effect` (or `EffectOnMethod`/`EffectOnClass`) from `./decorators`
  - Import `SetMeta` from `./decorators`
  - Build `EffectHooks` with logging callbacks that use `createLogWrapper`, `buildArgsObject`, `getParameterNames`
  - Extract parameter names at decoration time (in the method path)
  - For class path: call `Effect(hooks, NO_LOG_METADATA_KEY)(target)` then `injectLoggerIfMissing(target)`
  - For method path: call `EffectOnMethod(hooks)(target, propertyKey, descriptor)`
- [X] Remove `LoggableConstructor` type
- [X] Update `LogDecorator` interface: class overload should accept `<T extends new (...args: any[]) => any>`
- [X] Rewrite `NoLog` as: `export const NoLog = () => SetMeta(NO_LOG_METADATA_KEY, true);`
- [X] Update JSDoc on `Log` to remove "Requirements: class must have logger property" and note auto-injection
- [X] Preserve all existing JSDoc examples, updating them as needed

**Complexity**: Large
**Uncertainty**: Medium (integrating Effect hooks with the existing logging format; prototype getter/setter for auto-injection)
**Risks**:
- `injectLoggerIfMissing` prototype getter/setter must work with TypeScript class field `readonly logger = new Logger(...)` which compiles to constructor assignment. The setter pattern handles this.
- `getParameterNames` must still work correctly on wrapped functions. Since parameter names are extracted at decoration time (before wrapping), this is safe.

**Integration Points**: This is where the generic decorator layer meets the logging layer.

#### Verification

**Level:** CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/log.decorator.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| API Preservation | 0.20 | Log(options?) and NoLog() external API unchanged; LogDecorator interface updated to accept any class; LoggableConstructor removed |
| Effect Integration | 0.25 | Log delegates to Effect/EffectOnMethod with logging hooks; NoLog is SetMeta one-liner; no applyToMethod/applyToClass imports |
| Auto-Injection | 0.25 | injectLoggerIfMissing uses prototype getter/setter pattern; lazy Logger creation; setter override for user-defined loggers |
| Structured Logging | 0.15 | Logging hooks produce correct structured format {method, state, args, error?} via createLogWrapper/buildArgsObject |
| Documentation | 0.15 | JSDoc on Log updated to remove logger requirement; NoLog JSDoc preserved; getParameterNames is local non-exported |

**Reference Pattern:** `src/log.decorator.ts` (current implementation being rewritten)

---

### Step 8: Update Existing Tests and Add Integration Tests [DONE]

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 7
**Parallel with:** Step 9, Step 10

**Goal**: Update `tests/log.decorator.spec.ts` to reflect the new behavior (auto-injection instead of throw, double-logging prevention with call count assertions) and add new integration test scenarios.

#### Expected Output

- `tests/log.decorator.spec.ts` (updated): Removed throw test, added auto-injection tests, added double-log count assertions, added edge case tests

#### Success Criteria

- [X] Test "should throw error if logger property is not found" (line 333) is removed or replaced with auto-injection test
- [X] New test: "should auto-inject logger when class has no logger property" -- verifies method-level @Log works without explicit logger
- [X] New test: "should auto-inject logger for class-level @Log" -- verifies class-level @Log works without explicit logger
- [X] New test: "should preserve existing logger when class defines one" -- verifies mock logger is used, not auto-injected
- [X] Existing test "should work with mixed class-level and method-level decorators" updated with `toHaveBeenCalledTimes` assertions to verify no double-logging
- [X] New test: "should not double-log when class-level and method-level @Log() are both applied" -- explicit call count verification (2 log calls total: invoked + success, not 4)
- [X] New test: "should handle anonymous class expressions" -- no crash, logs work
- [X] New test: "should handle class with getters and setters" -- getters/setters not wrapped
- [X] New test: "should handle class inheritance" -- parent method logged when subclass decorated
- [X] All existing tests that still apply continue to pass
- [X] All tests pass: `npx vitest run tests/log.decorator.spec.ts`

#### Subtasks

- [X] Remove or replace the "should throw error if logger property is not found" test with an auto-injection success test
- [X] Add auto-injection test for method-level @Log (class without logger property, method decorated, verify logging works)
- [X] Add auto-injection test for class-level @Log (class without logger property, class decorated, verify logging works)
- [X] Add test verifying existing logger is preserved (mock logger receives calls, no additional logger created)
- [X] Update "should work with mixed class-level and method-level decorators" test to add `mockLogger.log.mockClear()` before method2 call and `expect(mockLogger.log).toHaveBeenCalledTimes(2)` after (invoked + success)
- [X] Add dedicated double-logging prevention test: class with @Log() and method with @Log({onInvoke: true}), call method once, assert exactly 2 logger.log calls
- [X] Add anonymous class test: `const Svc = Log()(class { method() { return 1; } })`, verify no crash
- [X] Add getter/setter test: class with getter and @Log(), verify getter not wrapped
- [X] Add inheritance test: parent class with method, subclass with @Log(), verify parent method logged

**Complexity**: Medium
**Uncertainty**: Low
**Risks**: Some existing tests may need minor adjustments if the internal behavior changes (e.g., parameter name extraction timing)

#### Verification

**Level:** Single Judge
**Artifact:** `tests/log.decorator.spec.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Acceptance Coverage | 0.30 | Tests cover: auto-injection (method+class), preserved logger, double-log prevention, anonymous class, getters/setters, inheritance |
| Double-Log Assertions | 0.25 | Explicit toHaveBeenCalledTimes assertions verifying exactly 2 log calls (invoked+success) not 4 |
| Regression Safety | 0.20 | All existing valid tests preserved/adapted; throw test replaced with auto-injection test |
| Edge Cases | 0.15 | Anonymous class, getters/setters, inheritance scenarios tested |
| Test Quality | 0.10 | Tests are independent, clear names, no brittle assertions |

**Reference Pattern:** `tests/log.decorator.spec.ts` (current test file being updated)

---

### Step 9: Update Exports and Delete Legacy Files [DONE]

**Model:** haiku
**Agent:** haiku
**Depends on:** Step 7
**Parallel with:** Step 8, Step 10

**Goal**: Update `src/index.ts` to remove legacy exports and add new decorator primitive exports. Delete `src/decorate/applyToMethod.ts` and `src/decorate/applyToClass.ts`.

#### Expected Output

- `src/index.ts` (updated): New exports added, legacy exports removed
- `src/decorate/applyToMethod.ts` (deleted)
- `src/decorate/applyToClass.ts` (deleted)

#### Success Criteria

- [X] `src/index.ts` no longer exports from `./decorate/applyToMethod` or `./decorate/applyToClass`
- [X] `src/index.ts` exports from `./decorators` (barrel): `Effect`, `EffectOnMethod`, `EffectOnClass`, `SetMeta`, `getMeta`, `setMeta`, `EFFECT_APPLIED_KEY`, `EffectHooks`, `OnInvokeHook`, `AfterReturnHook`, `OnErrorHook`, `FinallyHook`
- [X] All existing non-removed exports still work: `Log`, `NoLog`, `LogOptions`, `LogArgsFormatter`, `NO_LOG_METADATA_KEY`, `LogWrapper`, `Loggable`, `isLoggable`, `createLogWrapper`, `buildArgsObject`, `prettifyAxiosError`, `isAxiosError`, `isTimeoutError`
- [X] `src/decorate/applyToMethod.ts` deleted
- [X] `src/decorate/applyToClass.ts` deleted
- [X] `src/decorate/` directory deleted (if empty)
- [X] Build succeeds: `npm run build`
- [X] Typecheck passes: `npx tsc --noEmit`

#### Subtasks

- [X] Update `src/index.ts`:
  - Remove line `export * from './decorate/applyToMethod';`
  - Remove line `export * from './decorate/applyToClass';`
  - Add line `export * from './decorators';`
- [X] Delete `src/decorate/applyToMethod.ts`
- [X] Delete `src/decorate/applyToClass.ts`
- [X] Delete `src/decorate/` directory
- [X] Verify build: `npm run build`
- [X] Verify typecheck: `npx tsc --noEmit`

**Complexity**: Small
**Uncertainty**: Low
**Risks**: Consumers importing `applyToMethod` or `applyToClass` directly will break (accepted per spec)

#### Verification

**Level:** NOT NEEDED
**Rationale:** Export list changes and file deletions are binary success/failure operations. Build and typecheck in Step 11 validate correctness. No qualitative judgment needed.

---

### Step 10: Update README Documentation [DONE]

**Model:** opus
**Agent:** sdd:tech-writer
**Depends on:** Step 7
**Parallel with:** Step 8, Step 9

**Goal**: Update README.md to reflect that the `logger` property is no longer required, update all code examples, and document the new decorator primitives.

#### Expected Output

- `README.md` (updated): Removed logger requirement, updated examples, added decorator primitive docs

#### Success Criteria

- [X] Quick Start example no longer shows `readonly logger = new Logger(...)` as mandatory
- [X] New "Zero Configuration" or similar section showing `@Log()` works without explicit logger
- [X] All code examples updated: logger property shown as optional
- [X] "Requirements" text removed or updated to note logger is auto-injected
- [X] API Reference table updated with new exports
- [X] Existing usage examples still accurate
- [X] No broken markdown formatting

#### Subtasks

- [X] Update Quick Start example to show @Log() without explicit logger
- [X] Add note explaining that logger is auto-injected using class name as context
- [X] Update "Complete Example" section to show logger is optional
- [X] Update "Requirements" text in JSDoc section
- [X] Remove or update text about "class must have a public `logger` property"
- [X] Update API Reference table with new exports (Effect, SetMeta, etc.)
- [X] Review all other examples and ensure consistency

**Complexity**: Medium
**Uncertainty**: Low

#### Verification

**Level:** Single Judge
**Artifact:** `README.md`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Logger Requirement Removed | 0.30 | Quick Start shows @Log() without explicit logger; "must have logger property" text removed/updated |
| Example Accuracy | 0.25 | All code examples updated; logger shown as optional; existing examples still accurate |
| New Exports Documented | 0.20 | API Reference table includes Effect, SetMeta, getMeta, EffectOnMethod, EffectOnClass, hook decorators |
| Consistency | 0.15 | Terminology consistent; no contradictory statements about logger requirement |
| Formatting | 0.10 | No broken markdown; sections flow logically |

---

### Step 11: Final Verification

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 8, Step 9, Step 10
**Parallel with:** None

**Goal**: Run the complete build, test, and typecheck pipeline to ensure everything works together.

#### Expected Output

- Clean build output
- All tests passing
- No type errors

#### Success Criteria

- [X] `npm run build` succeeds with no errors
- [X] `npx vitest run` passes all tests (both new and existing)
- [X] `npx tsc --noEmit` passes with no type errors
- [X] No files in `src/decorators/` import from `@nestjs/common`
- [X] All acceptance criteria from the task spec are verified

#### Subtasks

- [X] Run `npm run build` and verify success
- [X] Run `npx vitest run` and verify all tests pass
- [X] Run `npx tsc --noEmit` and verify no type errors
- [X] Manually verify `src/decorators/` has no `@nestjs/common` imports (grep check)
- [X] Review all acceptance criteria checkboxes against implementation

**Complexity**: Small
**Uncertainty**: Low
**Risks**: Integration issues may surface; fix in prior steps

#### Verification

**Level:** NOT NEEDED
**Rationale:** Binary pass/fail verification step. Build, test, and typecheck either succeed or fail. No qualitative judgment needed on artifacts.

---

## Verification Summary

| Step | Verification Level | Judges | Threshold | Artifacts |
|------|-------------------|--------|-----------|-----------|
| 1 | Panel (2) | 2 | 4.0/5.0 | `src/decorators/set-meta.decorator.ts` |
| 2 | Panel (2) | 2 | 4.0/5.0 | `src/decorators/effect-on-method.ts` |
| 3 | Panel (2) | 2 | 4.0/5.0 | `src/decorators/effect-on-class.ts` |
| 4 | Single Judge | 1 | 4.0/5.0 | `src/decorators/effect.decorator.ts` |
| 5 | Per-Item (5) | 5 | 4.0/5.0 | 4 hook files + `src/decorators/index.ts` |
| 6 | Single Judge | 1 | 4.0/5.0 | `src/LogWrapper.ts` |
| 7 | Panel (2) | 2 | 4.0/5.0 | `src/log.decorator.ts` |
| 8 | Single Judge | 1 | 4.0/5.0 | `tests/log.decorator.spec.ts` |
| 9 | None | - | - | Export updates + file deletions |
| 10 | Single Judge | 1 | 4.0/5.0 | `README.md` |
| 11 | None | - | - | Build/test/typecheck output |

**Total Evaluations:** 17
**Implementation Command:** `/implement .specs/tasks/todo/remove-logger-requirement.refactor.md`

---

## Implementation Summary

| Step | Goal | Output | Agent | Est. Effort |
|------|------|--------|-------|-------------|
| 1 | Create dirs + SetMeta/getMeta | `set-meta.decorator.ts` + tests | sdd:developer | S |
| 2 | EffectOnMethod lifecycle wrapping | `effect-on-method.ts` + tests | sdd:developer | L |
| 3 | EffectOnClass prototype iteration | `effect-on-class.ts` + tests | sdd:developer | M |
| 4 | Effect unified decorator | `effect.decorator.ts` + tests | sdd:developer | S |
| 5 | Hook decorators + barrel export | 4 hook files + `index.ts` + 4 test files | sdd:developer | M |
| 6 | LogWrapper auto-injection | `LogWrapper.ts` updated | sdd:developer | S |
| 7 | Rebuild Log/NoLog decorators | `log.decorator.ts` rewritten | sdd:developer | L |
| 8 | Update and add integration tests | `log.decorator.spec.ts` updated | sdd:developer | M |
| 9 | Update exports, delete legacy | `index.ts` + delete `decorate/` | haiku | S |
| 10 | README documentation | `README.md` updated | sdd:tech-writer | M |
| 11 | Final verification | Build + test + typecheck | sdd:developer | S |

**Total Steps**: 11 (merged from 12 original)
**Steps Merged**: Old Step 1 (dirs) + Old Step 2 (SetMeta) -> New Step 1
**Critical Path**: Steps 1 -> 2 -> 3 -> 4 -> 5 -> 7 -> 8 -> 11 (longest serial chain)
**Max Parallelization Depth**: 3 steps simultaneously (Steps 8, 9, 10 after Step 7)
**Parallel Opportunities**:
- Step 1 and Step 6 MUST run in parallel (both have no dependencies)
- Steps 8, 9, and 10 MUST run in parallel after Step 7 completes
- Within Step 5, all 4 hook decorators MUST be implemented in parallel

---

## Risks & Blockers Summary

### High Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| EffectOnMethod async promise chain error handling | High - incorrect error propagation breaks all async logging | Medium | Comprehensive async tests in Step 2; test both resolve and reject paths with all hook combinations |
| Prototype getter/setter for auto-injection conflicts with TypeScript class fields | High - user-defined `readonly logger = new Logger(...)` could be overwritten | Medium | Setter pattern creates own-property on instance, which takes precedence over prototype getter; test explicitly in Step 8 |
| Metadata (`_symMeta` Map) not copied during function wrapping | High - NoLog metadata lost when EffectOnMethod wraps a function, causing NoLog to stop working | Medium | Explicit copy step in EffectOnMethod; test metadata preservation in Step 2 |
| Double-wrap prevention EFFECT_APPLIED_KEY not set correctly | High - double-logging bug persists | Low | Direct test in Steps 2, 3, 4, and 8 |

### Medium Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| Breaking change removing `applyToMethod`/`applyToClass` exports | Medium - consumers using internal APIs break | Low (accepted) | Documented as accepted breaking change in task spec |
| `this.constructor.name` empty in minified builds | Low - logger context is empty string | Low | tsdown outputs CJS with preserved class names; document as known limitation |
| `finally` keyword as property name in EffectHooks interface | Low - potential TS parsing issue | Low | TypeScript supports `finally` as interface property name; verify in Step 2 |

---

## High Complexity/Uncertainty Tasks Requiring Attention

**Step 2: Implement EffectOnMethod Decorator**
- Complexity: Large (lifecycle hook management, sync/async dual path, metadata copying, EFFECT_APPLIED_KEY sentinel)
- Uncertainty: Medium (async promise chaining with all four hooks, metadata Map copying semantics)
- Recommendation: This is already the most granular it can be as a single component. The sync and async paths are tightly coupled. Mitigate risk with comprehensive test coverage (12+ test cases specified).

**Step 7: Rebuild Log and NoLog Decorators**
- Complexity: Large (integrating Effect hooks with existing logging format, auto-injection via prototype getter/setter, preserving all existing behavior)
- Uncertainty: Medium (prototype getter/setter interaction with TypeScript class fields; ensuring parameter name extraction at decoration time works correctly with the new architecture)
- Recommendation: This is already well-scoped. The subtasks break it into: injectLoggerIfMissing, move getParameterNames, rewrite Log body, rewrite NoLog, update types. Risk is mitigated by running existing tests (Step 8) immediately after.

---

## Definition of Done (Task Level)

- [X] All 11 implementation steps completed
- [X] All acceptance criteria from the task spec verified by passing tests
- [X] All existing tests pass (adapted as needed)
- [X] New tests cover: auto-injection, double-log prevention, all decorator primitives, all edge cases
- [X] JSDoc documentation present on all new exported decorators, functions, and types
- [X] README updated to reflect that the logger property is optional
- [X] The abstract decorator primitives (`src/decorators/`) contain no logging-specific code and no NestJS-specific imports
- [X] Legacy `applyToMethod` and `applyToClass` modules are removed and no longer exported
- [X] All decorators compose and reuse each other with no duplicated logic
- [X] `npm run build` succeeds
- [X] `npx vitest run` passes all tests
- [X] `npx tsc --noEmit` passes with no type errors
- [X] No high-priority risks unaddressed
