#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/scripts/package-and-upload-oss.sh"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "expected script at $SCRIPT_PATH" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

TEST_ROOT="$WORK_DIR/repo"
export TEST_ROOT
mkdir -p "$TEST_ROOT/dist" "$TEST_ROOT/scripts" "$TEST_ROOT/bin"
cp "$SCRIPT_PATH" "$TEST_ROOT/scripts/package-and-upload-oss.sh"
chmod +x "$TEST_ROOT/scripts/package-and-upload-oss.sh"

cat > "$TEST_ROOT/dist/index.html" <<'EOF'
<html>ok</html>
EOF

cat > "$TEST_ROOT/bin/ossutil" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > "$TEST_ROOT/ossutil-args.txt"
printf '%s' "${OSS_ENDPOINT:-}" > "$TEST_ROOT/ossutil-endpoint.txt"
EOF
chmod +x "$TEST_ROOT/bin/ossutil"

export PATH="$TEST_ROOT/bin:$PATH"
export OSS_ACCESS_KEY_ID="test-ak"
export OSS_ACCESS_KEY_SECRET="test-sk"

(
  cd "$TEST_ROOT"
  bash ./scripts/package-and-upload-oss.sh > "$TEST_ROOT/run.log"
)

test -f "$TEST_ROOT/itsm-2.zip"
grep -qx 'cp' "$TEST_ROOT/ossutil-args.txt"
grep -qx "$TEST_ROOT/itsm-2.zip" "$TEST_ROOT/ossutil-args.txt"
grep -qx 'oss://sre-uniops/web/itsm-2.zip' "$TEST_ROOT/ossutil-args.txt"
grep -qx 'http://oss-cn-dalian-cic-d01-a.ops.cloud.cic.inter' "$TEST_ROOT/ossutil-endpoint.txt"

echo "smoke test passed"
