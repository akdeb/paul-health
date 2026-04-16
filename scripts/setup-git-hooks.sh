#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

git -C "$ROOT_DIR" config core.hooksPath .githooks

echo "Configured git hooks path to .githooks"
