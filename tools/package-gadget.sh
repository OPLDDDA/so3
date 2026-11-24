#!/usr/bin/env bash
# macOS only. Input: decrypted IPA. Output: one .ipa with FridaGadget inside.
# The .dylib is downloaded into a temp dir and never leaves it.
set -euo pipefail

IPA="${1:?usage: package-gadget.sh app.ipa [gadget_version]}"
VER="${2:-16.2.2}"

GADGET_URL="https://github.com/frida/frida/releases/download/${VER}/frida-gadget-${VER}-ios-universal.dylib.gz"

if [ ! -f "$IPA" ]; then
  echo "input IPA not found: $IPA" >&2
  exit 1
fi

if ! command -v insert_dylib >/dev/null 2>&1; then
  echo "missing insert_dylib: brew install insert_dylib" >&2
  exit 1
fi

WORK="$(mktemp -d)"
OUT="${IPA%.ipa}-gadget.ipa"
case "$OUT" in
  /*) ;;
  *)  OUT="$PWD/$OUT" ;;
esac
trap 'rm -rf "$WORK"' EXIT

echo "[1/5] downloading Frida gadget ${VER}"
curl -fL --retry 3 -o "$WORK/gadget.dylib.gz" "$GADGET_URL"
gunzip -f "$WORK/gadget.dylib.gz"
chmod 755 "$WORK/gadget.dylib"

echo "[2/5] unpacking IPA"
unzip -q "$IPA" -d "$WORK/Payload"
APP="$(find "$WORK/Payload" -maxdepth 1 -name '*.app' -type d | head -n1)"
if [ -z "$APP" ]; then
  echo "no .app bundle found inside IPA" >&2
  exit 1
fi

echo "[3/5] injecting gadget"
cp "$WORK/gadget.dylib" "$APP/FridaGadget.dylib"
BIN="$(plutil -extract CFBundleExecutable raw -o - "$APP/Info.plist")"
insert_dylib --inplace --all-yes @executable_path/FridaGadget.dylib "$APP/$BIN"

echo "[4/5] writing gadget config"
cat > "$APP/FridaGadget.config" <<'EOF'
{
  "interaction": {
    "type": "listen",
    "address": "127.0.0.1",
    "port": 27042,
    "on_load": "wait"
  }
}
EOF

echo "[5/5] writing IPA"
(cd "$WORK" && zip -qry "$OUT" Payload)

echo "done: $OUT"
