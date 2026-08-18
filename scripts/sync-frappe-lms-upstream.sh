#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_REPO="https://github.com/frappe/lms.git"
readonly UPSTREAM_TAG="v2.61.0"
readonly UPSTREAM_COMMIT="d3bfe97d178eb076310dffd7407106bcdec15d67"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CHECKOUT_ROOT="$REPO_ROOT/.upstream/frappe-lms"
readonly VENDOR_ROOT="$REPO_ROOT/vendor/frappe-lms"

mkdir -p "$REPO_ROOT/.upstream" "$VENDOR_ROOT"

if [[ ! -d "$CHECKOUT_ROOT/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$UPSTREAM_REPO" "$CHECKOUT_ROOT"
fi

git -C "$CHECKOUT_ROOT" remote set-url origin "$UPSTREAM_REPO"
git -C "$CHECKOUT_ROOT" fetch --filter=blob:none origin tag "$UPSTREAM_TAG"
git -C "$CHECKOUT_ROOT" sparse-checkout init --no-cone
printf '%s\n' \
  '/frontend/**' \
  '!/frontend/public/*.mp4' \
  '!/frontend/public/manifest/apple-splash-*.jpg' \
  '/license.txt' \
  > "$CHECKOUT_ROOT/.git/info/sparse-checkout"
git -C "$CHECKOUT_ROOT" checkout --detach "$UPSTREAM_COMMIT"

printf 'Upstream verification:\n'
git -C "$CHECKOUT_ROOT" remote -v
git -C "$CHECKOUT_ROOT" rev-parse HEAD
git -C "$CHECKOUT_ROOT" describe --tags --always

printf '\nDiff before sync:\n'
git diff --no-index --stat "$VENDOR_ROOT/frontend" "$CHECKOUT_ROOT/frontend" || true

rsync -a --delete --exclude manifest.json \
  "$CHECKOUT_ROOT/frontend/" "$VENDOR_ROOT/frontend/"
cp "$CHECKOUT_ROOT/license.txt" "$VENDOR_ROOT/license.txt"

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
    applicationBase: "frontend",
    strategy: "blobless sparse vendor snapshot",
    importedPaths: ["frontend", "license.txt"],
    excludedPaths: [
      "frontend/public/*.mp4",
      "frontend/public/manifest/apple-splash-*.jpg"
    ],
    generatedAt: new Date().toISOString(),
    checksum: { algorithm: "sha256", tree: checksum }
  };
  fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
' "$VENDOR_ROOT/manifest.json" "$tree_checksum"

printf '\nSynced Frappe LMS %s (%s) to %s\n' \
  "$UPSTREAM_TAG" "$UPSTREAM_COMMIT" "$VENDOR_ROOT"
