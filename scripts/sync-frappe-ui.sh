#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_REPO="https://github.com/frappe/lms.git"
readonly UPSTREAM_TAG="v2.61.0"
readonly UPSTREAM_COMMIT="d3bfe97d178eb076310dffd7407106bcdec15d67"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly VENDOR_ROOT="$REPO_ROOT/vendor/frappe-lms"
readonly WORK_ROOT="$(mktemp -d /tmp/frappe-lms-sync.XXXXXX)"

cleanup() {
  rm -rf "$WORK_ROOT"
}
trap cleanup EXIT

git clone --filter=blob:none --no-checkout --depth 1 --branch "$UPSTREAM_TAG" \
  "$UPSTREAM_REPO" "$WORK_ROOT/upstream"

git -C "$WORK_ROOT/upstream" sparse-checkout init --no-cone
printf '%s\n' \
  '/frontend/**' \
  '!/frontend/public/*.mp4' \
  '!/frontend/public/manifest/apple-splash-*.jpg' \
  '/license.txt' \
  > "$WORK_ROOT/upstream/.git/info/sparse-checkout"
git -C "$WORK_ROOT/upstream" checkout --detach "$UPSTREAM_COMMIT"

mkdir -p "$VENDOR_ROOT"
rsync -a --delete --exclude manifest.json \
  "$WORK_ROOT/upstream/frontend/" "$VENDOR_ROOT/frontend/"
cp "$WORK_ROOT/upstream/license.txt" "$VENDOR_ROOT/license.txt"

tree_checksum="$({
  find "$VENDOR_ROOT/frontend" -type f -print0
  printf '%s\0' "$VENDOR_ROOT/license.txt"
} | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | awk '{print $1}')"

node -e '
  const fs = require("node:fs");
  const [path, checksum] = process.argv.slice(1);
  const manifest = {
    upstream: {
      repo: "https://github.com/frappe/lms.git",
      tag: "v2.61.0",
      commit: "d3bfe97d178eb076310dffd7407106bcdec15d67"
    },
    strategy: "blobless sparse vendor snapshot",
    fetchedPaths: ["frontend", "license.txt"],
    excludedPaths: [
      "frontend/public/*.mp4",
      "frontend/public/manifest/apple-splash-*.jpg"
    ],
    checksum: { algorithm: "sha256", tree: checksum }
  };
  fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
' "$VENDOR_ROOT/manifest.json" "$tree_checksum"

printf 'Synced Frappe LMS %s (%s) to %s\n' \
  "$UPSTREAM_TAG" "$UPSTREAM_COMMIT" "$VENDOR_ROOT"
