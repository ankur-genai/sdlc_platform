#!/usr/bin/env bash
# Restore the Business Analyst agent to this checkpoint.
# Usage: bash RESTORE.sh
set -euo pipefail

CHECKPOINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/root/sdlc-platform-main/backend/fastapi_agents/agents/business_analyst"

echo "Restoring Business Analyst agent from checkpoint:"
echo "  $CHECKPOINT_DIR  ->  $TARGET_DIR"

for f in agent.py prompts.py schemas.py __init__.py; do
  cp -v "$CHECKPOINT_DIR/$f" "$TARGET_DIR/$f"
done

# The split prompt sections were added AFTER this checkpoint. Remove them so the
# restored single-file prompts.py is self-contained again.
if [[ -d "$TARGET_DIR/prompt_sections" ]]; then
  echo "Removing prompt_sections/ (added after this checkpoint)"
  rm -rf "$TARGET_DIR/prompt_sections"
fi

echo "Restore complete."
