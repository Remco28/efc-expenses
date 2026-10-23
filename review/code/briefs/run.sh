#!/usr/bin/env bash
# Run the four reviewers on these briefs, in parallel, 25 minutes each. Usage: bash review/code/briefs/run.sh <output-dir>
set -u; R=$(cd "$(dirname "$0")/../../.." && pwd); B="$R/review/code/briefs"; D=${1:?output dir}; mkdir -p "$D"; cd "$R"
timeout 1500 codex exec -s read-only -C "$R" --skip-git-repo-check "$(cat "$B/codex.txt")" > "$D/codex.out" 2>&1 &
timeout 1500 grok -m grok-4.7 --cwd "$R" --always-approve --disable-web-search -p "$(cat "$B/grok.txt")" > "$D/grok.out" 2>&1 &
timeout 1500 agy -p "$(cat "$B/agy.txt")" --model gemini-3.8-flash-high --mode plan --print-timeout 1400s > "$D/agy.out" 2>&1 &
timeout 1500 opencode run -m opencode/deepseek-v4.1-flash-free --dir "$R" "$(cat "$B/opencode.txt")" > "$D/opencode.out" 2>&1 &
wait; wc -c "$D"/*.out
