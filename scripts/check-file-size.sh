#!/usr/bin/env bash
# check-file-size.sh — Blocks src/ files with >300 lines (excludes __tests__/ and templates/, see ADR-007)
# Usage: bash scripts/check-file-size.sh [--report-only]
set -euo pipefail

MAX_LINES=300
VIOLATIONS=0
REPORT_ONLY=false

if [ "${1:-}" = "--report-only" ]; then
  REPORT_ONLY=true
fi

while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "VIOLATION F-06: $file has $lines lines (max: $MAX_LINES)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(find src -name "*.ts" \
  -not -path "*/__tests__/*" \
  -not -path "*/templates/*" \
  -print0)

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total: $VIOLATIONS file(s) violating F-06."
  if [ "$REPORT_ONLY" = true ]; then
    echo "REPORT-ONLY mode: violations detected but not blocking."
    exit 0
  fi
  exit 1
fi

echo "F-06 check passed: no files exceed $MAX_LINES lines."
