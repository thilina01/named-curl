#!/usr/bin/env bash
set -euo pipefail

RELEASE_BRANCH="${RELEASE_BRANCH:-master}"
REMOTE="${REMOTE:-origin}"
TAG_PREFIX="v"
COMMIT_MSG_TEMPLATE="chore: bump version to %s"
TAG_MSG_TEMPLATE="Release %s"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN=false
BUMP="patch"

usage() {
  echo "Usage: $(basename "$0") [--dry-run] [patch|minor|major]"
  echo ""
  echo "If no semver tag exists yet, the current manifest.json version becomes the first tag."
  echo "Otherwise the script bumps the latest semver tag, updates manifest.json, runs validation, commits, tags, and pushes."
  echo ""
  echo "Options:"
  echo "  --dry-run    Show what would happen without making changes"
  echo "  -h, --help   Show this help message"
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    patch|minor|major) BUMP="$arg" ;;
    -h|--help) usage ;;
    *)
      echo "Error: invalid argument '$arg'." >&2
      usage
      ;;
  esac
done

cd "$PROJECT_ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  echo "Error: detached HEAD is not supported. Check out '$RELEASE_BRANCH' first." >&2
  exit 1
fi

if [[ "$BRANCH" != "$RELEASE_BRANCH" ]]; then
  echo "Error: tagging is only allowed on '$RELEASE_BRANCH' (current branch: '$BRANCH')." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

git fetch "$REMOTE" "$BRANCH" --tags --quiet 2>/dev/null || true

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH" 2>/dev/null || true)"

if [[ -n "$REMOTE_HEAD" && "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  BEHIND="$(git rev-list --count HEAD.."$REMOTE/$BRANCH")"
  AHEAD="$(git rev-list --count "$REMOTE/$BRANCH"..HEAD)"

  if [[ "$BEHIND" -gt 0 ]]; then
    echo "Error: local '$BRANCH' is $BEHIND commit(s) behind $REMOTE/$BRANCH. Pull first." >&2
    exit 1
  fi

  if [[ "$AHEAD" -gt 0 ]]; then
    echo "Warning: local '$BRANCH' is $AHEAD commit(s) ahead of $REMOTE/$BRANCH." >&2
  fi
fi

MANIFEST_VERSION="$(node --input-type=module -e "import fs from 'node:fs'; const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8')); process.stdout.write(String(manifest.version || ''));" )"

if ! [[ "$MANIFEST_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: manifest.json version must use X.Y.Z format. Current value: '$MANIFEST_VERSION'." >&2
  exit 1
fi

LATEST_TAG="$(git tag --sort=-v:refname | grep -E "^${TAG_PREFIX}[0-9]+\.[0-9]+\.[0-9]+$" | head -n 1 || true)"
NEW_VERSION=""
NEW_TAG=""
INITIAL_RELEASE=false

if [[ -z "$LATEST_TAG" ]]; then
  INITIAL_RELEASE=true
  NEW_VERSION="$MANIFEST_VERSION"
  NEW_TAG="${TAG_PREFIX}${NEW_VERSION}"
else
  LATEST_VERSION="${LATEST_TAG#"$TAG_PREFIX"}"

  if [[ "$MANIFEST_VERSION" != "$LATEST_VERSION" ]]; then
    echo "Error: manifest.json version '$MANIFEST_VERSION' does not match latest tag '$LATEST_TAG'." >&2
    echo "Sync manifest.json with the latest release before creating a new tag." >&2
    exit 1
  fi

  IFS='.' read -r MAJOR MINOR PATCH <<< "$LATEST_VERSION"

  case "$BUMP" in
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    patch)
      PATCH=$((PATCH + 1))
      ;;
  esac

  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
  NEW_TAG="${TAG_PREFIX}${NEW_VERSION}"
fi

if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  echo "Error: tag '$NEW_TAG' already exists." >&2
  exit 1
fi

COMMIT_MSG="$(printf "$COMMIT_MSG_TEMPLATE" "$NEW_VERSION")"
TAG_MSG="$(printf "$TAG_MSG_TEMPLATE" "$NEW_TAG")"

if $INITIAL_RELEASE; then
  echo "Initial tag      : $NEW_TAG"
  echo "manifest.json    : $MANIFEST_VERSION"
else
  echo "Latest tag       : $LATEST_TAG"
  echo "New tag          : $NEW_TAG"
  echo "manifest.json    : $MANIFEST_VERSION -> $NEW_VERSION"
fi
echo "Branch           : $BRANCH"
echo "Commit message   : $COMMIT_MSG"

if $DRY_RUN; then
  echo ""
  echo "[dry-run] No changes will be made."
  exit 0
fi

echo ""
read -rp "Run validation, commit manifest.json, create tag $NEW_TAG, and push? [y/N] " CONFIRM
if [[ "$CONFIRM" != [yY] ]]; then
  echo "Aborted."
  exit 0
fi

if ! $INITIAL_RELEASE; then
  NEW_VERSION="$NEW_VERSION" node --input-type=module -e 'import fs from "node:fs"; const file = "manifest.json"; const manifest = JSON.parse(fs.readFileSync(file, "utf8")); manifest.version = process.env.NEW_VERSION; fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);'
fi

npm test
npm run check

if $INITIAL_RELEASE; then
  git add manifest.json
  if git diff --cached --quiet; then
    echo "No manifest version change required for the initial release commit. Skipping version bump commit." >&2
  else
    git commit -m "$COMMIT_MSG"
  fi
else
  git add manifest.json
  git commit -m "$COMMIT_MSG"
fi

git tag -a "$NEW_TAG" -m "$TAG_MSG"

if $INITIAL_RELEASE && git diff --cached --quiet; then
  git push "$REMOTE" "$NEW_TAG"
else
  git push "$REMOTE" HEAD "$NEW_TAG"
fi

echo ""
echo "Tagged $NEW_TAG and pushed to $REMOTE. The GitHub release workflow should take over from here."