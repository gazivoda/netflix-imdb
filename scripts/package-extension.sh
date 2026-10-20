#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/extension.zip"
# The copy the website serves at /downloads/rating-watch-extension.zip
DOWNLOAD="$ROOT/public/downloads/rating-watch-extension.zip"

echo "Packaging extension..."

cd "$ROOT/extension"
rm -f "$OUT"
zip -q -r "$OUT" . -x '.DS_Store' '*/.DS_Store' '*/.git/*' '*/node_modules/*'

mkdir -p "$(dirname "$DOWNLOAD")"
cp "$OUT" "$DOWNLOAD"

echo "Created: $OUT"
echo "Copied to: $DOWNLOAD"
echo ""
echo "Files included:"
unzip -l "$OUT"
