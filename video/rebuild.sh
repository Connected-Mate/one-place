#!/bin/bash
# One command, from the app's committed code to the finished films:
#   npm run rebuild            uses the repository's current commit (HEAD)
#   npm run rebuild -- <commit>
# Footage and voices come from a temporary copy of that commit, never from the working copy,
# so someone editing the app meanwhile cannot change or break a capture. The copy and its server are removed at the end.
#   FILM_OUT     where the finished files go (default ~/Documents/Perso/One Place)
#   FILM_SCRATCH where raw captures go (default: this session's scratch folder)
#   FILM_SKIP_CAPTURE=1  keeps the existing captures, for a change in the edit or the sound only
#   FILM_MUSIC=custom|temp  the track of the main film (custom: audio/music-custom.<ext>)
#   FILM_DROP=<seconds>  where the drop is in that track, landing on the One Place mark (found by itself when not given)
#   FILM_SAMPLES=8  motion blur samples per frame
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
REF="${1:-HEAD}"; COMMIT="$(git -C "$REPO" rev-parse --short "$REF")"
export FILM_SCRATCH="${FILM_SCRATCH:-/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film}"
OUT="${FILM_OUT:-$HOME/Documents/Perso/One Place}"; PORT="${FILM_PORT:-5199}"
SNAP="$FILM_SCRATCH/appsnap-$COMMIT"; FF="$HERE/node_modules/ffmpeg-static/ffmpeg"
mkdir -p "$FILM_SCRATCH" "$OUT/proof"
[ -x "$FF" ] || (cd "$HERE" && npm install --no-audit --no-fund)

SERVER=""
cleanup() {
  [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null || true
  [ -d "$SNAP" ] && git -C "$REPO" worktree remove --force "$SNAP" 2>/dev/null || true
}
trap cleanup EXIT

echo "== app at $COMMIT"
git -C "$REPO" worktree add --force --detach "$SNAP" "$COMMIT" >/dev/null 2>&1
ln -s "$REPO/node_modules" "$SNAP/node_modules"
export FILM_PUBLIC="$SNAP/public" FILM_APP="http://localhost:$PORT/one-place/"

if [ -z "${FILM_SKIP_CAPTURE:-}" ]; then
  (cd "$SNAP" && exec "$REPO/node_modules/.bin/vite" "$SNAP" --port "$PORT" --strictPort >"$FILM_SCRATCH/vite-snap.log" 2>&1) &
  SERVER=$!
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$FILM_APP" && break; sleep 1; done
  echo "== capture"
  (cd "$HERE/capture" && node shots.mjs)
  kill "$SERVER" 2>/dev/null || true; SERVER=""
fi

SAMPLES="${FILM_SAMPLES:-4}"; MAIN="${FILM_MUSIC:-custom}"
echo "== sound"
(cd "$HERE" && node audio/make-audio.mjs --music "$MAIN" ${FILM_DROP:+--drop "$FILM_DROP"} --out "$FILM_SCRATCH/mix-$MAIN.wav" | grep -E "^music|I:|Peak")
echo "== films"
for f in 16x9 1x1; do
  (cd "$HERE" && node render.mjs --format "$f" --audit 0.1 | tail -1)
  M="$OUT/one-place-film-v2-$f-4k.mp4"; L="$OUT/one-place-film-v2-$f-1080-for-X-upload.mp4"
  (cd "$HERE" && node render.mjs --format "$f" --scale 2 --fps 60 --samples "$SAMPLES" --workers 7 --audio "$FILM_SCRATCH/mix-$MAIN.wav" --out "$M" | grep -E "rendered|failed")
  S="1920:1080"; [ "$f" = 1x1 ] && S="1080:1080"
  "$FF" -hide_banner -loglevel error -y -i "$M" -vf "scale=$S:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 16 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -movflags +faststart "$L"
done
echo "== posters and proof"
TL() { (cd "$HERE" && node -e "import('./film/timeline.mjs').then(m=>console.log(m.timeline(process.env.FILM_SCRATCH).$1[0]+$2))"); }
for f in 16x9 1x1; do
  M="$OUT/one-place-film-v2-$f-4k.mp4"
  for p in "mark merge 1.1" "project project 6.8" "wow bcall 1.8" "end-card end 2.6"; do set -- $p; "$FF" -hide_banner -loglevel error -y -ss "$(TL "$2" "$3")" -i "$M" -frames:v 1 -q:v 1 -update 1 "$OUT/poster-v2-$f-$1.jpg"; done
  (cd "$HERE" && SC=480 ./sheet-video.sh "$M" "$OUT/proof/contact-sheet-v2-$f-2s.jpg" 2 6 0 76)
  "$FF" -hide_banner -nostats -i "$M" -af ebur128=peak=true -f null - 2>&1 | awk '/Summary/{p=1} p' | grep -E "I:|Peak:" || true
done
(cd "$HERE" && node audio/inspect.mjs "$FILM_SCRATCH/mix-$MAIN.wav" "$OUT/proof/waveform-v2.png" >/dev/null) || true
echo "== done: $OUT (app at $COMMIT)"
