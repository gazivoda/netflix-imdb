#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/extension.zip"

echo "Packaging extension..."

cd "$ROOT/extension"
zip -r "$OUT" . \
  --exclude "*.DS_Store" \
  --exclude "*/.git/*" \
  --exclude "*/node_modules/*"

echo "Created: $OUT"
echo ""
echo "Files included:"
unzip -l "$OUT"
