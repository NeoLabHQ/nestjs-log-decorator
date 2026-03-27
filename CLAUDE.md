# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use @README.md for project overview, @CONTRIBUTING.md for contributing guidelines, @package.json for avaiable commands.

## Commit Conventions

This project uses **semantic-release** with **Conventional Commits**. Follow the `type(scope): subject` format (feat, fix, docs, style, refactor, perf, test, chore, ci) for commits.

## Architecture

**Purpose:** A zero-dependency TypeScript decorator library for NestJS that eliminates try-catch logging boilerplate from service methods.

**Build:** tsdown compiles `src/` to `dist/` as CommonJS (CJS only). TypeScript declarations are emitted via `emitDeclarationOnly` in tsconfig. Peer dependency: `@nestjs/common`.

**Core flow:**

1. `@Log()` (src/log.decorator.ts) — Unified decorator that detects whether it's applied to a class or method via argument count, then delegates to `applyToClass` or `applyToMethod`.
2. `applyToMethod` (src/decorate/applyToMethod.ts) — Wraps a single method: extracts parameter names from the function's `toString()` representation, builds an args object, creates a `LogWrapper`, and handles sync/async execution with success/error logging.
3. `applyToClass` (src/decorate/applyToClass.ts) — Iterates all prototype methods (skipping constructor and `@NoLog()`-marked methods) and applies `applyToMethod` to each.
4. `LogWrapper` (src/LogWrapper.ts) — Formats and outputs structured log entries (`invoked`, `success`, `error` states) through the NestJS Logger. Contains `createLogWrapper` (validates logger existence), `buildArgsObject` (maps param names to values), and `isLoggable` type guard.
5. `@NoLog()` — Marks methods with a Symbol to exclude them from class-level logging.

**Axios handling:** The library has no runtime axios dependency. `src/axios/axios.stub.ts` defines local interfaces mirroring Axios types, and `isAxiosError` checks `payload.isAxiosError === true`. `prettifyAxiosError` in `axios.logger.ts` formats Axios errors with structured request/response data when detected.
