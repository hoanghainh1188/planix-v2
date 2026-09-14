#!/usr/bin/env bash
# Format-on-save hook — chạy sau mỗi Write/Edit (PostToolUse) để format file vừa sửa.
# Được gọi từ .claude/settings.json: `bash .claude/hooks/format.sh`.
# Stack: TypeScript monorepo → Prettier repo-local (decision 2026-09-14-005-tech-stack).
set -euo pipefail

FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.json|*.css|*.yaml|*.yml)
    npx --no-install prettier --write --log-level warn "$FILE" >/dev/null 2>&1 || true
    ;;
esac
exit 0
