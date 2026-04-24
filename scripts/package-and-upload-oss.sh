#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DIST_DIR="$ROOT_DIR/dist"
readonly ZIP_NAME="itsm-2.zip"
readonly ZIP_PATH="$ROOT_DIR/$ZIP_NAME"
readonly OSS_ENDPOINT_VALUE="http://oss-cn-dalian-cic-d01-a.ops.cloud.cic.inter"
readonly OSS_BUCKET="sre-uniops"
readonly OSS_OBJECT_PATH="web/itsm-2.zip"
readonly OSS_URI="oss://${OSS_BUCKET}/${OSS_OBJECT_PATH}"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "missing required command: $command_name" >&2
    exit 1
  fi
}

require_env() {
  local env_name="$1"

  if [[ -z "${!env_name:-}" ]]; then
    echo "missing required environment variable: $env_name" >&2
    exit 1
  fi
}

ensure_dist_ready() {
  if [[ ! -d "$DIST_DIR" ]]; then
    echo "dist directory not found: $DIST_DIR" >&2
    exit 1
  fi

  shopt -s dotglob nullglob
  local dist_entries=("$DIST_DIR"/*)
  shopt -u dotglob nullglob

  if [[ ${#dist_entries[@]} -eq 0 ]]; then
    echo "dist directory is empty: $DIST_DIR" >&2
    exit 1
  fi
}

prepare_environment() {
  require_command zip
  require_command ossutil
  ensure_dist_ready

  export OSS_ENDPOINT="$OSS_ENDPOINT_VALUE"

  if [[ -n "${OSS_SECURITY_TOKEN:-}" && -z "${OSS_SESSION_TOKEN:-}" ]]; then
    export OSS_SESSION_TOKEN="$OSS_SECURITY_TOKEN"
  fi
}

build_archive() {
  rm -f "$ZIP_PATH"

  (
    cd "$DIST_DIR"
    zip -rq "$ZIP_PATH" .
  )
}

upload_archive() {
  ossutil cp "$ZIP_PATH" "$OSS_URI"
}

main() {
  prepare_environment
  build_archive
  upload_archive

  echo "archive: $ZIP_PATH"
  echo "uploaded to: $OSS_URI"
}

main "$@"
