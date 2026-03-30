# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use @README.md for project overview, @CONTRIBUTING.md for contributing guidelines, @package.json for avaiable commands.

## Commit Conventions

This project uses **semantic-release** with **Conventional Commits**. Follow the `type(scope): subject` format (feat, fix, docs, style, refactor, perf, test, chore, ci) for commits.

## Architecture

**Purpose:** A zero-dependency TypeScript decorator library for NestJS that eliminates try-catch logging boilerplate from service methods.

**Build:** tsdown compiles `src/` to `dist/` as CommonJS (CJS only). TypeScript declarations are emitted via `emitDeclarationOnly` in tsconfig. Peer dependency: `@nestjs/common`.

**Core flow:**

1. `@Log()` (src/log.decorator.ts) — Unified decorator that detects whether it's applied to a class or method via argument count, then delegates to `Effect` (class) or `EffectOnMethod` (method). Builds a `HooksOrFactory` function that creates a `LogWrapper` once per invocation and wires up `onInvoke`, `onReturn`, and `onError` hooks.
2. `Effect` / `EffectOnMethod` / `EffectOnClass` (src/decorators/) — Logger-agnostic decorator primitives. `EffectOnMethod` wraps a single method: extracts parameter names, builds a `HookContext` (args object, target, propertyKey, descriptor, parameterNames, className), and invokes lifecycle hooks. `EffectOnClass` iterates prototype methods and applies `EffectOnMethod` to each. `Effect` dispatches to one or the other based on argument count.
3. `buildArgsObject` (src/decorators/effect-on-method.ts) — Maps parameter names to their call-time values to produce the pre-built `args` object passed in every `HookContext`.
4. `LogWrapper` (src/LogWrapper.ts) — Formats and outputs structured log entries (`invoked`, `success`, `error` states) through the NestJS Logger. Contains `createLogWrapper` (auto-injects a NestJS Logger when the instance has no `logger` property) and `isLoggable` type guard.
5. `@NoLog()` — Marks methods with a Symbol to exclude them from class-level logging.

**Axios handling:** The library has no runtime axios dependency. `src/axios/axios.stub.ts` defines local interfaces mirroring Axios types, and `isAxiosError` checks `payload.isAxiosError === true`. `prettifyAxiosError` in `axios.logger.ts` formats Axios errors with structured request/response data when detected.
