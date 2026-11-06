#!/bin/bash
# Contact sheet of chosen moments: sheet.sh <format> <out.jpg> <cols> <t1,t2,...>
HERE="$(cd "$(dirname "$0")" && pwd)"; FMT=$1; OUT=$2; COLS=$3; TS=$4
SCRATCH=${FILM_SCRATCH:-/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film}
D=$(mktemp -d "$SCRATCH/st.XXXX"); cd "$HERE"
node render.mjs --format "$FMT" --stills "$TS" --dir "$D" || exit 1
N=$(ls "$D" | wc -l); R=$(( (N+COLS-1)/COLS ))
W=640; [ "$FMT" = 1x1 ] && W=480
node_modules/ffmpeg-static/ffmpeg -hide_banner -loglevel error -y -framerate 1 -pattern_type glob -i "$D/*.jpg" -vf "scale=$W:-1,pad=iw+6:ih+6:3:3:gray,tile=${COLS}x${R}:color=gray" -frames:v 1 -update 1 "$OUT"
ls "$D" | sed 's/.*-//' | tr '\n' ' '; echo
for f in "$D"/*; do /bin/rm "$f"; done; rmdir "$D"
