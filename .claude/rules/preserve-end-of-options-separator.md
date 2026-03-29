---
title: Preserve End-of-Options Separator in Wrapper Commands
impact: HIGH
paths:
  - "**/*.sh"
---

# Preserve End-of-Options Separator in Wrapper Commands

When modifying commands that wrap other commands (retry, xargs, find -exec, env, etc.), preserve the `--` end-of-options separator. Without `--`, the wrapper tool may misinterpret the wrapped command's flags as its own, causing silent failures or argument parsing errors.

## Incorrect

Removing `--` when the wrapped command has flags that could conflict with the wrapper's options.

```bash
# retry interprets bash's -c as its own flag: "retry: invalid option -- 'c'"
retry --times 3 --delay 60 bash -c 'my_function "$@"' bash "$@"
```

## Correct

Keep `--` to explicitly separate wrapper flags from the wrapped command.

```bash
# -- tells retry to stop parsing its own flags; bash -c is passed as the command
retry --times 3 --delay 60 -- bash -c 'my_function "$@"' bash "$@"
```
