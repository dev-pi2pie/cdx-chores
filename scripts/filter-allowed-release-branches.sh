#!/usr/bin/env bash
set -euo pipefail

while IFS= read -r branch || [ -n "$branch" ]; do
  if [[ "$branch" =~ ^origin/(beta|alpha|canary|dev) ]]; then
    printf '%s\n' "$branch"
  fi
done
