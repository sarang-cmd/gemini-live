#!/usr/bin/env bash
#
# Build the desktop application and package it for this machine.
#
# `npm run dist` does the same thing, but this script explains each step and
# fails with a readable message when the Electron runtime is missing.
#
# The Electron runtime is not part of the npm package: it is downloaded from
# the GitHub releases the first time `npm install` runs. If that download is
# blocked, point ELECTRON_MIRROR at a mirror that is reachable, or unpack a
# runtime into node_modules/electron/dist yourself.

set -euo pipefail

cd "$(dirname "$0")/.."

PLATFORM="${1:-$(node -p 'process.platform')}"
TARGET="${2:-}"

case "$PLATFORM" in
  darwin | win32 | linux) ;;
  *)
    echo "Unknown platform: $PLATFORM (expected darwin, win32 or linux)" >&2
    exit 1
    ;;
esac

if [ ! -d "node_modules/electron/dist" ]; then
  echo "The Electron runtime is missing from node_modules/electron/dist." >&2
  echo "Run 'npm install' with access to the Electron releases, or set" >&2
  echo "ELECTRON_MIRROR to a mirror that is reachable from this machine." >&2
  exit 1
fi

echo "==> Building the main process, the preload bridge and the renderer"
npm run build

echo "==> Packaging for $PLATFORM"
if [ -n "$TARGET" ]; then
  npx electron-builder --"$PLATFORM" "$TARGET" --publish never
else
  npx electron-builder --"$PLATFORM" --publish never
fi

echo
echo "==> The artefacts are in release/"
ls -1 release
