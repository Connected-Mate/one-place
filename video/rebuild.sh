#!/bin/bash
# One command, from the app's committed code to the finished films:
#   npm run rebuild            uses the repository's current commit (HEAD)
#   npm run rebuild -- <commit>
# Footage and voices come from a temporary copy of that commit, never from the working copy,
# so someone editing the app meanwhile cannot change or break a capture. The copy and its server are removed at the end.
#   FILM_OUT     where the finished files go (default ~/Documents/Perso/One Place)
#   FILM_SCRATCH where raw captures go (default: this session's scratch folder)
#   FILM_SKIP_CAPTURE=1  keeps the existing captures, for a change in the edit or the sound only
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
REF="${1:-HEAD}"; COMMIT="$(git -C "$REPO" rev-parse --short "$REF")"
export FILM_SCRATCH="${FILM_SCRATCH:-/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film}"
OUT="${FILM_OUT:-$HOME/Documents/Perso/One Place}"; PORT="${FILM_PORT:-5188}"
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
  (cd "$SNAP" && exec npx vite --port "$PORT" --strictPort >"$FILM_SCRATCH/vite-snap.log" 2>&1) &
  SERVER=$!
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$FILM_APP" && break; sleep 1; done
  echo "== capture"
  (cd "$HERE/capture" && node shots.mjs)
  kill "$SERVER" 2>/dev/null || true; SERVER=""
fi

echo "== sound"
(cd "$HERE" && node audio/make-audio.mjs | grep -E "I:|Peak|wow")
echo "== checks and films"
for f in 16x9 1x1; do
  (cd "$HERE" && node render.mjs --format "$f" --audit 0.1 | tail -1)
  (cd "$HERE" && node render.mjs --format "$f" --samples 12 --workers 7 --audio audio/mix.wav --out "$OUT/one-place-film-$f.mp4" | grep -E "rendered|failed")
done

echo "== posters and proof"
for f in 16x9 1x1; do
  M="$OUT/one-place-film-$f.mp4"
  "$FF" -hide_banner -loglevel error -y -ss 14.2 -i "$M" -frames:v 1 -q:v 1 -update 1 "$OUT/poster-$f-mark.jpg"
  "$FF" -hide_banner -loglevel error -y -ss 37.3 -i "$M" -frames:v 1 -q:v 1 -update 1 "$OUT/poster-$f-wow.jpg"
  "$FF" -hide_banner -loglevel error -y -ss 50.8 -i "$M" -frames:v 1 -q:v 1 -update 1 "$OUT/poster-$f-people.jpg"
  "$FF" -hide_banner -loglevel error -y -ss 58.5 -i "$M" -frames:v 1 -q:v 1 -update 1 "$OUT/poster-$f-end-card.jpg"
  (cd "$HERE" && SC=480 ./sheet-video.sh "$M" "$OUT/proof/contact-sheet-$f-2s.jpg" 2 6 0 60)
  "$FF" -hide_banner -nostats -i "$M" -af ebur128=peak=true -f null - 2>&1 | awk '/Summary/{p=1} p' | grep -E "I:|Peak:" || true
done
(cd "$HERE" && node audio/inspect.mjs audio/mix.wav "$OUT/proof/waveform.png" >/dev/null)
echo "== done: $OUT (app at $COMMIT)"
