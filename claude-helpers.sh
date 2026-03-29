#!/usr/bin/env bash
# Shared helper functions for claude justfile recipes.
# Source this file at the top of each recipe that needs these utilities:
#   source "$(dirname "${BASH_SOURCE[0]:-$0}")/../scripts/claude-helpers.sh"
# Or from justfile recipes:
#   source "scripts/claude-helpers.sh"
#
# Dependencies: retry (apt-get install retry / brew install retry), timeout (coreutils)

# ── Configuration defaults ──────────────────────────────────────────
MAX_SESSION_RETRIES="${MAX_SESSION_RETRIES:-12}"
SESSION_RETRY_WAIT="${SESSION_RETRY_WAIT:-3600}"    # 1 hour in seconds
COMMAND_TIMEOUT="${COMMAND_TIMEOUT:-21600}"          # 6 hours in seconds
PERMISSION_MODE="${PERMISSION_MODE:---permission-mode auto}"

DRAFT_DIR="${DRAFT_DIR:-.specs/tasks/draft}"
TODO_DIR="${TODO_DIR:-.specs/tasks/todo}"
DONE_DIR="${DONE_DIR:-.specs/tasks/done}"

# ── JSON schemas for structured output validation ───────────────────
COMPLETED_SCHEMA='{"type":"object","properties":{"completed":{"type":"boolean"},"message":{"type":"string"}},"required":["completed"]}'
NEXT_TASK_SCHEMA='{"type":"object","properties":{"allDone":{"type":"boolean"},"filenames":{"type":"object","properties":{"epic":{"type":"string"},"task":{"type":"string"}}}},"required":["allDone"]}'

# ── Check if retry utility is available ────────────────────────────
_check_retry() {
  if ! command -v retry &> /dev/null; then
    echo "ERROR: 'retry' utility not found. Install with: apt-get install retry (Debian/Ubuntu) or brew install retry (macOS)" >&2
    return 1
  fi
}

# ── Raw claude streaming call (no retry) ────────────────────────────
# Internal helper. Not intended for direct use.
# Outputs plain text by extracting text deltas from stream-json format.
_raw_claude_stream() {
  local prompt="$1"
  # shellcheck disable=SC2086
  timeout "$COMMAND_TIMEOUT" claude -p "$prompt" \
    --output-format stream-json --verbose --include-partial-messages \
    $PERMISSION_MODE | \
    jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
}

# ── Raw claude JSON call (no retry) ─────────────────────────────────
# Internal helper. Not intended for direct use.
# Outputs JSON response. Optional second argument is JSON schema for structured output.
_raw_claude_json() {
  local prompt="$1"
  local schema="${2:-}"
  # shellcheck disable=SC2086
  if [ -n "$schema" ]; then
    timeout "$COMMAND_TIMEOUT" claude -p "$prompt" \
      --output-format json \
      --verbose \
      --json-schema "$schema" \
      $PERMISSION_MODE
  else
    timeout "$COMMAND_TIMEOUT" claude -p "$prompt" \
      --output-format json \
      --verbose \
      $PERMISSION_MODE
  fi
}

# ── Shared retry wrapper for any CLI error ────────────────────────
# Retries a shell function on ANY non-zero exit using the 'retry' utility.
#
# Args: label, fn_name, [fn_args...]
run_with_session_retry() {
  _check_retry || return 1

  local label="$1"; shift

  # Export the target function so subshell can see it
  export -f "$1" 2>/dev/null || true

  echo "==> [$label] Running with retry (max $((MAX_SESSION_RETRIES + 1)) attempts, timeout ${COMMAND_TIMEOUT}s)..." >&2

  # retry: --times=N (number of retries), --delay=seconds between retries
  retry \
    --times "$((MAX_SESSION_RETRIES + 1))" \
    --delay "$SESSION_RETRY_WAIT" \
    -- bash -c '"$@"' bash "$@"
}

# ── Plan/implement with retry and prompt switching ──────────────────
# First attempt uses initial_prompt; retries use continue_prompt.
#
# Args: label, initial_prompt, continue_prompt
run_plan_or_implement_retry() {
  _check_retry || return 1

  local label="$1"
  local initial_prompt="$2"
  local continue_prompt="$3"

  # Export helper so retry subshell can see it
  export -f _raw_claude_stream 2>/dev/null || true

  local attempt=0

  _attempt_fn() {
    attempt=$((attempt + 1))
    local prompt="$initial_prompt"
    if [ "$attempt" -gt 1 ]; then
      prompt="$continue_prompt"
      echo "==> [$label] Retry attempt $attempt/$((MAX_SESSION_RETRIES + 1))..." >&2
    fi
    _raw_claude_stream "$prompt"
  }
  export -f _attempt_fn
  export initial_prompt continue_prompt label attempt

  echo "==> [$label] Running with retry (max $((MAX_SESSION_RETRIES + 1)) attempts, timeout ${COMMAND_TIMEOUT}s)..." >&2

  retry \
    --times "$((MAX_SESSION_RETRIES + 1))" \
    --delay "$SESSION_RETRY_WAIT" \
    -- bash -c '_attempt_fn'
}

# ── Extract structured_output field from claude JSON response ───────
# Handles both array format (claude --verbose JSON output, where the
# result element has type=="result") and plain object format.
# Falls back to parsing .result as JSON if structured_output is absent.
extract_structured_field() {
  local json="$1"
  local field="$2"
  local fallback="${3:-}"

  # Normalize: if input is an array, extract the result element
  local result_obj
  result_obj=$(echo "$json" | jq -r '
    if type == "array" then
      (.[] | select(.type == "result"))
    else
      .
    end
  ' 2>/dev/null || echo "")

  if [ -z "$result_obj" ]; then
    echo "$fallback"
    return
  fi

  local value
  value=$(echo "$result_obj" | jq -r ".structured_output.$field // empty" 2>/dev/null || echo "")
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    echo "$value"
    return
  fi

  # Fallback: try parsing .result as JSON
  local result_text
  result_text=$(echo "$result_obj" | jq -r '.result // empty' 2>/dev/null || echo "")
  if [ -n "$result_text" ]; then
    value=$(echo "$result_text" | jq -r ".$field // empty" 2>/dev/null || echo "")
    if [ -n "$value" ] && [ "$value" != "null" ]; then
      echo "$value"
      return
    fi
  fi

  echo "$fallback"
}
