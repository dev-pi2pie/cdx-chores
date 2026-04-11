#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Generate stable release notes from a git range.

Usage:
  scripts/generate-stable-release-notes.sh \
    [--mode <commit|pr|hybrid>] \
    --range <git-range> \
    --current-tag <tag> \
    [--previous-tag <tag>] \
    [--repository <owner/repo>] \
    [--fallback-login <@login>]

Examples:
  scripts/generate-stable-release-notes.sh \
    --mode commit \
    --range "abc123..def456" \
    --current-tag "v1.2.3" \
    --previous-tag "v1.2.2" \
    --repository "<owner>/<repo>"
  scripts/generate-stable-release-notes.sh \
    --mode pr \
    --range "abc123..def456" \
    --current-tag "v1.2.3" \
    --repository "<owner>/<repo>"
  scripts/generate-stable-release-notes.sh \
    --mode hybrid \
    --range "abc123..def456" \
    --current-tag "v1.2.3" \
    --repository "<owner>/<repo>"
  scripts/generate-stable-release-notes.sh \
    --mode commit \
    --range "abc123..def456" \
    --current-tag "v1.2.3" \
    --fallback-login "@your-account-name"

Notes:
  - GitHub login/PR resolution uses GitHub REST API via curl+jq.
  - Set GH_TOKEN or GITHUB_TOKEN to avoid low unauthenticated API rate limits.
EOF
}

MODE="commit"
RELEASE_RANGE=""
CURRENT_TAG=""
PREVIOUS_TAG=""
REPOSITORY=""
FALLBACK_LOGIN=""
REPO_ROOT=""
CHANGELOG_OVERRIDE_PATH=""
CHANGELOG_OVERRIDE_BLOB=""
CHANGELOG_OVERRIDE_CONTENT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --range)
      RELEASE_RANGE="${2:-}"
      shift 2
      ;;
    --current-tag)
      CURRENT_TAG="${2:-}"
      shift 2
      ;;
    --previous-tag)
      PREVIOUS_TAG="${2:-}"
      shift 2
      ;;
    --repository)
      REPOSITORY="${2:-}"
      shift 2
      ;;
    --fallback-login)
      FALLBACK_LOGIN="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$RELEASE_RANGE" ] || [ -z "$CURRENT_TAG" ]; then
  echo "Both --range and --current-tag are required." >&2
  usage >&2
  exit 1
fi

if [ "$MODE" != "commit" ] && [ "$MODE" != "pr" ] && [ "$MODE" != "hybrid" ]; then
  echo "Invalid --mode: $MODE (expected: commit, pr, or hybrid)" >&2
  usage >&2
  exit 1
fi

if [ -z "$REPOSITORY" ]; then
  ORIGIN_URL=$(git config --get remote.origin.url 2>/dev/null || true)
  if [[ "$ORIGIN_URL" =~ github.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    REPOSITORY="${BASH_REMATCH[1]}"
  fi
fi

if [ -n "$FALLBACK_LOGIN" ] && [[ "$FALLBACK_LOGIN" != @* ]]; then
  FALLBACK_LOGIN="@$FALLBACK_LOGIN"
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [[ "$CURRENT_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  CHANGELOG_OVERRIDE_PATH="$REPO_ROOT/CHANGELOGS/$CURRENT_TAG.md"
  CHANGELOG_OVERRIDE_BLOB="$CURRENT_TAG:CHANGELOGS/$CURRENT_TAG.md"
fi

if [ -n "$CHANGELOG_OVERRIDE_BLOB" ] && git cat-file -e "$CHANGELOG_OVERRIDE_BLOB" 2>/dev/null; then
  CHANGELOG_OVERRIDE_CONTENT=$(git show "$CHANGELOG_OVERRIDE_BLOB")

  if ! printf '%s' "$CHANGELOG_OVERRIDE_CONTENT" | grep -q '[^[:space:]]'; then
    echo "Stable release notes override exists but is empty: CHANGELOGS/$CURRENT_TAG.md" >&2
    exit 1
  fi

  printf '%s\n' "$CHANGELOG_OVERRIDE_CONTENT"
  exit 0
fi

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

GROUP_KEYS=(
  "new_features"
  "bug_fixes"
  "performance"
  "refactors"
  "documentation"
  "tests"
  "build"
  "ci"
  "chores"
  "reverts"
  "other_changes"
)

group_label() {
  case "$1" in
    new_features) echo "New Features" ;;
    bug_fixes) echo "Bug Fixes" ;;
    performance) echo "Performance" ;;
    refactors) echo "Refactors" ;;
    documentation) echo "Documentation" ;;
    tests) echo "Tests" ;;
    build) echo "Build" ;;
    ci) echo "CI" ;;
    chores) echo "Chores" ;;
    reverts) echo "Reverts" ;;
    other_changes) echo "Other Changes" ;;
    *) echo "Other Changes" ;;
  esac
}

group_file() {
  printf '%s/%s.txt\n' "$TMP_DIR" "$1"
}

github_api_get() {
  local path="$1"
  local jq_expr="$2"
  local token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  local api_url="https://api.github.com/$path"
  local response=""

  if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    printf ''
    return
  fi

  if [ -n "$token" ]; then
    response=$(
      curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer $token" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "$api_url" 2>/dev/null || true
    )
  else
    response=$(
      curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "$api_url" 2>/dev/null || true
    )
  fi

  if [ -z "$response" ]; then
    printf ''
    return
  fi

  printf '%s' "$response" | jq -r "$jq_expr // empty" 2>/dev/null || true
}

resolve_github_login_for_commit() {
  local sha="$1"
  local author_email="$2"
  local from_pr=""
  local from_commit=""
  local from_committer=""
  local from_email=""

  if [ -z "$REPOSITORY" ]; then
    printf ''
    return
  fi

  from_pr=$(github_api_get "repos/$REPOSITORY/commits/$sha/pulls" 'if length > 0 and .[0].user and .[0].user.login then "@\(.[0].user.login)" else "" end')
  if [ -n "$from_pr" ]; then
    printf '%s' "$from_pr"
    return
  fi

  from_commit=$(github_api_get "repos/$REPOSITORY/commits/$sha" 'if .author and .author.login then "@\(.author.login)" else "" end')
  if [ -n "$from_commit" ]; then
    printf '%s' "$from_commit"
    return
  fi

  from_committer=$(github_api_get "repos/$REPOSITORY/commits/$sha" 'if .committer and .committer.login then "@\(.committer.login)" else "" end')
  if [ -n "$from_committer" ]; then
    printf '%s' "$from_committer"
    return
  fi

  if [ -n "$author_email" ]; then
    local encoded_email
    encoded_email=$(printf '%s' "$author_email" | jq -sRr @uri 2>/dev/null || true)
    if [ -n "$encoded_email" ]; then
      from_email=$(github_api_get "search/users?q=${encoded_email}+in:email&per_page=2" 'if .total_count == 1 and .items[0].login then "@\(.items[0].login)" else "" end')
    fi
  fi

  printf '%s' "$from_email"
}

set_group_and_display_from_subject() {
  local subject="$1"
  GROUP_KEY="other_changes"
  DISPLAY_MESSAGE="$subject"

  if [[ "$subject" =~ ^([[:alpha:]]+)(\(([[:alnum:]./_-]+)\))?:[[:space:]]+(.+)$ ]]; then
    local type="${BASH_REMATCH[1]}"
    local type_lower
    type_lower=$(printf '%s' "$type" | tr '[:upper:]' '[:lower:]')
    local scope="${BASH_REMATCH[3]:-}"
    local message="${BASH_REMATCH[4]}"

    case "$type_lower" in
      feat) GROUP_KEY="new_features" ;;
      fix) GROUP_KEY="bug_fixes" ;;
      perf) GROUP_KEY="performance" ;;
      refactor) GROUP_KEY="refactors" ;;
      docs) GROUP_KEY="documentation" ;;
      test) GROUP_KEY="tests" ;;
      build) GROUP_KEY="build" ;;
      ci) GROUP_KEY="ci" ;;
      chore) GROUP_KEY="chores" ;;
      revert) GROUP_KEY="reverts" ;;
      *) GROUP_KEY="other_changes" ;;
    esac

    if [ -n "$scope" ]; then
      DISPLAY_MESSAGE="**$scope:** $message"
    else
      DISPLAY_MESSAGE="$message"
    fi
  elif [[ "$subject" =~ ^Bump[[:space:]] ]]; then
    GROUP_KEY="chores"
  fi
}

print_changelog_range() {
  if [ -n "$PREVIOUS_TAG" ]; then
    printf 'Full Changelog: %s...%s\n' "$PREVIOUS_TAG" "$CURRENT_TAG"
  else
    printf 'Full Changelog: %s\n' "$CURRENT_TAG"
  fi
}

COMMITS_FILE="$TMP_DIR/commits.tsv"
ALL_CHANGES_FILE="$TMP_DIR/all_changes.txt"
PR_ITEMS_FILE="$TMP_DIR/pr_items.tsv"
PR_ITEMS_SEEN_FILE="$TMP_DIR/pr_items_seen.txt"

for KEY in "${GROUP_KEYS[@]}"; do
  : > "$(group_file "$KEY")"
done

: > "$ALL_CHANGES_FILE"
: > "$PR_ITEMS_FILE"
: > "$PR_ITEMS_SEEN_FILE"

git log --no-merges --reverse --format='%H%x09%s%x09%an%x09%ae' "$RELEASE_RANGE" > "$COMMITS_FILE"

if [ ! -s "$COMMITS_FILE" ]; then
  printf '%s\n' "## What's Changed"
  printf '\n%s\n' "- No notable changes in this release."
  printf '\n%s\n' "### Changelog"
  print_changelog_range
  printf '%s\n' "- No commits in selected range."
  exit 0
fi

format_contributor_for_mention() {
  local contributor="$1"
  if [ -z "$contributor" ]; then
    printf ''
    return
  fi

  if [[ "$contributor" == @* ]]; then
    printf '%s' "$contributor"
    return
  fi

  # Do not synthesize @mentions from local git author names.
  # Only use @mentions when explicitly resolved from GitHub APIs.
  printf '%s' "$contributor"
}

append_csv_unique() {
  local existing="$1"
  local item="$2"

  if [ -z "$item" ]; then
    printf '%s' "$existing"
    return
  fi

  if [ -z "$existing" ]; then
    printf '%s' "$item"
    return
  fi

  case ",$existing," in
    *",$item,"*) printf '%s' "$existing" ;;
    *) printf '%s, %s' "$existing" "$item" ;;
  esac
}

resolve_pr_for_commit() {
  local sha="$1"
  local subject="$2"

  local pr_number=""
  local pr_title=""
  local pr_author=""
  local pr_info=""

  if [ -n "$REPOSITORY" ]; then
    pr_info=$(github_api_get "repos/$REPOSITORY/commits/$sha/pulls" 'if length > 0 then "\(.[0].number)\t\(.[0].title)\t@\(.[0].user.login)" else "" end')
  fi

  if [ -n "$pr_info" ]; then
    IFS=$'\t' read -r pr_number pr_title pr_author <<EOF
$pr_info
EOF
  elif [[ "$subject" =~ ^(.+)[[:space:]]\(#([0-9]+)\)$ ]]; then
    pr_title="${BASH_REMATCH[1]}"
    pr_number="${BASH_REMATCH[2]}"
  fi

  printf '%s\t%s\t%s\n' "$pr_number" "$pr_title" "$pr_author"
}

while IFS=$'\t' read -r SHA SUBJECT AUTHOR_NAME AUTHOR_EMAIL; do
  [ -n "$SHA" ] || continue
  AUTHOR_GH_LOGIN=$(resolve_github_login_for_commit "$SHA" "$AUTHOR_EMAIL")
  RESOLVED_CONTRIBUTOR="$AUTHOR_NAME"
  if [ -n "$AUTHOR_GH_LOGIN" ]; then
    RESOLVED_CONTRIBUTOR="$AUTHOR_GH_LOGIN"
  elif [ -n "$FALLBACK_LOGIN" ]; then
    RESOLVED_CONTRIBUTOR="$FALLBACK_LOGIN"
  fi

  if [ "$MODE" = "commit" ]; then
    set_group_and_display_from_subject "$SUBJECT"

    printf -- '- %s\n' "$DISPLAY_MESSAGE" >> "$(group_file "$GROUP_KEY")"
    COMMIT_CONTRIBUTOR=$(format_contributor_for_mention "$RESOLVED_CONTRIBUTOR")
    CHANGELOG_LINE="- $SHA $DISPLAY_MESSAGE"
    if [ -n "$COMMIT_CONTRIBUTOR" ] && [[ "$COMMIT_CONTRIBUTOR" != *"[bot]"* ]]; then
      CHANGELOG_LINE="$CHANGELOG_LINE by $COMMIT_CONTRIBUTOR"
    fi
    printf '%s\n' "$CHANGELOG_LINE" >> "$ALL_CHANGES_FILE"
    continue
  fi

  # PR mode: one line per PR when possible, with inline contributor attribution.
  PR_NUMBER=""
  PR_TITLE=""
  PR_AUTHOR=""
  PR_LINE=$(resolve_pr_for_commit "$SHA" "$SUBJECT")
  IFS=$'\t' read -r PR_NUMBER PR_TITLE PR_AUTHOR <<EOF
$PR_LINE
EOF

  ITEM_KEY=""
  ITEM_REF=""
  ITEM_SUBJECT="$SUBJECT"
  ITEM_CONTRIBUTOR="$RESOLVED_CONTRIBUTOR"

  if [ -n "$PR_NUMBER" ]; then
    ITEM_KEY="pr:$PR_NUMBER"
    ITEM_REF="#$PR_NUMBER"
    if [ -n "$PR_TITLE" ]; then
      ITEM_SUBJECT="$PR_TITLE"
    fi
    if [ -n "$PR_AUTHOR" ]; then
      ITEM_CONTRIBUTOR="$PR_AUTHOR"
    fi
  else
    SHORT_SHA=$(printf '%s' "$SHA" | cut -c1-8)
    ITEM_KEY="commit:$SHA"
    ITEM_REF="$SHORT_SHA"
  fi

  set_group_and_display_from_subject "$ITEM_SUBJECT"
  ITEM_GROUP_KEY="$GROUP_KEY"
  ITEM_DISPLAY="$ITEM_SUBJECT"
  ITEM_CONTRIBUTOR=$(format_contributor_for_mention "$ITEM_CONTRIBUTOR")

  if ! grep -Fqx "$ITEM_KEY" "$PR_ITEMS_SEEN_FILE"; then
    printf '%s\n' "$ITEM_KEY" >> "$PR_ITEMS_SEEN_FILE"
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$ITEM_KEY" "$ITEM_GROUP_KEY" "$ITEM_REF" "$ITEM_DISPLAY" "$ITEM_CONTRIBUTOR" >> "$PR_ITEMS_FILE"
  else
    TMP_UPDATED="$TMP_DIR/pr_items.updated.tsv"
    : > "$TMP_UPDATED"
    while IFS=$'\t' read -r EXIST_KEY EXIST_GROUP EXIST_REF EXIST_DISPLAY EXIST_CONTRIBS; do
      if [ "$EXIST_KEY" = "$ITEM_KEY" ]; then
        UPDATED_CONTRIBS=$(append_csv_unique "$EXIST_CONTRIBS" "$ITEM_CONTRIBUTOR")
        UPDATED_GROUP="$EXIST_GROUP"
        if [ "$EXIST_GROUP" = "other_changes" ] && [ "$ITEM_GROUP_KEY" != "other_changes" ]; then
          UPDATED_GROUP="$ITEM_GROUP_KEY"
        fi
        printf '%s\t%s\t%s\t%s\t%s\n' \
          "$EXIST_KEY" "$UPDATED_GROUP" "$EXIST_REF" "$EXIST_DISPLAY" "$UPDATED_CONTRIBS" >> "$TMP_UPDATED"
      else
        printf '%s\t%s\t%s\t%s\t%s\n' \
          "$EXIST_KEY" "$EXIST_GROUP" "$EXIST_REF" "$EXIST_DISPLAY" "$EXIST_CONTRIBS" >> "$TMP_UPDATED"
      fi
    done < "$PR_ITEMS_FILE"
    mv "$TMP_UPDATED" "$PR_ITEMS_FILE"
  fi
done < "$COMMITS_FILE"

printf '%s\n' "## What's Changed"

if [ "$MODE" = "commit" ]; then
  for KEY in "${GROUP_KEYS[@]}"; do
    FILE=$(group_file "$KEY")
    if [ -s "$FILE" ]; then
      printf '\n### %s\n' "$(group_label "$KEY")"
      cat "$FILE"
    fi
  done
else
  for KEY in "${GROUP_KEYS[@]}"; do
    TMP_GROUP="$TMP_DIR/pr_group_${KEY}.txt"
    : > "$TMP_GROUP"
    while IFS=$'\t' read -r EXIST_KEY EXIST_GROUP EXIST_REF EXIST_DISPLAY EXIST_CONTRIBS; do
      if [ "$EXIST_GROUP" = "$KEY" ]; then
        LINE="- $EXIST_DISPLAY"
        if [ -n "$EXIST_REF" ]; then
          LINE="$LINE ($EXIST_REF)"
        fi
        printf '%s\n' "$LINE" >> "$TMP_GROUP"
      fi
    done < "$PR_ITEMS_FILE"

    if [ -s "$TMP_GROUP" ]; then
      printf '\n### %s\n' "$(group_label "$KEY")"
      cat "$TMP_GROUP"
    fi
  done
fi

printf '\n%s\n' "### Changelog"
print_changelog_range

if [ "$MODE" = "commit" ]; then
  cat "$ALL_CHANGES_FILE"
else
  while IFS=$'\t' read -r EXIST_KEY EXIST_GROUP EXIST_REF EXIST_DISPLAY EXIST_CONTRIBS; do
    LINE="-"
    if [ -n "$EXIST_REF" ]; then
      LINE="$LINE $EXIST_REF"
    fi
    LINE="$LINE $EXIST_DISPLAY"
    if [ -n "$EXIST_CONTRIBS" ]; then
      LINE="$LINE by $EXIST_CONTRIBS"
    fi
    printf '%s\n' "$LINE"
  done < "$PR_ITEMS_FILE"
fi
