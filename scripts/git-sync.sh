#!/usr/bin/env bash
# Two-way sync between this folder and GitHub (origin/main).
# Pulls remote changes first (rebasing local commits, stashing uncommitted work),
# then pushes local commits. Run: npm run sync
set -euo pipefail
cd "$(dirname "$0")/.."
branch="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin
git pull --rebase --autostash origin "$branch"
if [ -n "$(git log "origin/$branch..HEAD" --oneline)" ]; then
  git push origin "$branch"
else
  echo "Nothing to push. $branch matches origin/$branch."
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes remain. Commit them, then run npm run sync again."
fi
