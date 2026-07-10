#!/usr/bin/env bash
# scripts/create-demo.sh
#
# Assembles the app screenshots into an animated demo.gif for the README.
# Requires: ffmpeg  (brew install ffmpeg)
#
# Usage:
#   bash scripts/create-demo.sh           # → demo.gif at default 800×500
#   WIDTH=1280 bash scripts/create-demo.sh  # custom width (height scales proportionally)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/demo.gif"
TMP="$ROOT/.demo-tmp"
FPS=3

# Output canvas size — all frames are letterboxed to this with black bars
W="${WIDTH:-800}"
H=$(( W * 5 / 8 ))   # 8:5 ratio  (800→500, 1280→800)

mkdir -p "$TMP"

# Scale + letterbox a source image to ${W}x${H}
prep() {
  local src="$1" dst="$2"
  ffmpeg -y -loglevel error \
    -i "$src" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black" \
    "$dst"
}

echo "→ Preparing frames..."
#                source image                         output frame      # caption
prep "$ROOT/mock-01-home.png"           "$TMP/f01.png"  # Dashboard — live data + overdue banner
prep "$ROOT/mock-02-log-dialog.png"     "$TMP/f02.png"  # Log Intake dialog (Taken / Skipped / Missed)
prep "$ROOT/mock-03-after-log.png"      "$TMP/f03.png"  # After logging — adherence + streak update
prep "$ROOT/mock-05-day-panel.png"      "$TMP/f04.png"  # Calendar — day panel with intake history
prep "$ROOT/mock-07-analytics.png"      "$TMP/f05.png"  # Analytics — bar chart + medication breakdown
prep "$ROOT/02-home-desktop-light.png"  "$TMP/f06.png"  # Light theme
prep "$ROOT/08-home-mobile.png"         "$TMP/f07.png"  # Mobile layout

# Concat manifest — each image is held for `duration` seconds
# The final entry is duplicated at duration 0 (required by ffmpeg concat for last frame)
cat > "$TMP/concat.txt" << EOF
file '${TMP}/f01.png'
duration 3.5
file '${TMP}/f02.png'
duration 2.5
file '${TMP}/f03.png'
duration 2.5
file '${TMP}/f04.png'
duration 2.5
file '${TMP}/f05.png'
duration 3.0
file '${TMP}/f06.png'
duration 2.0
file '${TMP}/f07.png'
duration 2.5
file '${TMP}/f07.png'
duration 0
EOF

echo "→ Building colour palette..."
ffmpeg -y -loglevel error \
  -f concat -safe 0 -i "$TMP/concat.txt" \
  -vf "fps=${FPS},palettegen=max_colors=128:stats_mode=diff" \
  "$TMP/palette.png"

echo "→ Rendering GIF (${W}×${H} @ ${FPS}fps) ..."
ffmpeg -y -loglevel error \
  -f concat -safe 0 -i "$TMP/concat.txt" \
  -i "$TMP/palette.png" \
  -filter_complex "fps=${FPS}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$OUT"

rm -rf "$TMP"

SIZE=$(du -sh "$OUT" | cut -f1)
echo "✓  demo.gif written → $OUT  ($SIZE)"
echo ""
echo "   Embed in README with:"
echo "   ![Demo](demo.gif)"
