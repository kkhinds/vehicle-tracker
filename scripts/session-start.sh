#!/bin/bash
# SessionStart hook for Claude Code on the web: installs npm deps so
# typecheck, tests and build work as soon as a cloud session opens.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-save --no-audit --no-fund
