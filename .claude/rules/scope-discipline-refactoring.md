---
title: Strict Scope Adherence During Refactoring
impact: CRITICAL
---

# Strict Scope Adherence During Refactoring

When a task specifies particular changes (e.g., "extract X", "remove Y", "move Z"), only make those exact changes. Do not rename public API symbols, reorganize unrelated code, or apply "consistency improvements" to code adjacent to the requested changes. Unrequested changes to exported symbols break downstream consumers.

## Incorrect

Renaming a public export for consistency while performing an unrelated refactoring task.

```typescript
// Task: "Move parameter extraction to Effect layer"
// Agent also renames AfterReturnHook -> OnReturnHook because
// other hooks use "on" prefix and it "looks more consistent"
export { OnReturnHook } from './on-return.hook'; // BREAKING: was AfterReturnHook
export type { OnReturnHookType } from './hook.types'; // BREAKING: was AfterReturnHookType
```

## Correct

Only making the requested changes; flagging improvement ideas as comments or suggestions.

```typescript
// Task: "Move parameter extraction to Effect layer"
// Agent completes the requested move and leaves unrelated exports unchanged
export { AfterReturnHook } from './after-return.hook'; // Unchanged
export type { AfterReturnHookType } from './set-meta.decorator'; // Unchanged
// NOTE: AfterReturnHook could be renamed to OnReturnHook for consistency — suggest as follow-up
```
